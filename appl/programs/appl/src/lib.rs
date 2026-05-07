use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd");

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_MERCHANTS: usize = 10;
const MAX_NAME_LEN: usize = 32;
const MAX_URL_LEN: usize = 128;
const SECONDS_PER_DAY: i64 = 86_400;

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod appl {
    use super::*;

    /// Register an AI agent identity onchain so it can be discovered as a service.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        service_url: String,
        fee_lamports: u64,
    ) -> Result<()> {
        require!(name.len() <= MAX_NAME_LEN, ApplError::NameTooLong);
        require!(service_url.len() <= MAX_URL_LEN, ApplError::UrlTooLong);

        let identity = &mut ctx.accounts.agent_identity;
        identity.authority = ctx.accounts.authority.key();
        identity.name = name;
        identity.service_url = service_url;
        identity.fee_lamports = fee_lamports;
        identity.total_earned = 0;
        identity.is_active = true;
        identity.bump = ctx.bumps.agent_identity;

        msg!("Agent registered: {}", identity.name);
        Ok(())
    }

    /// Create a spending policy that constrains what an agent can pay.
    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        max_daily_spend: u64,
        approved_merchants: Vec<Pubkey>,
        expiry: i64,
    ) -> Result<()> {
        require!(
            approved_merchants.len() <= MAX_MERCHANTS,
            ApplError::TooManyMerchants
        );
        require!(max_daily_spend > 0, ApplError::InvalidAmount);

        let policy = &mut ctx.accounts.policy_account;
        policy.owner = ctx.accounts.owner.key();
        policy.agent = ctx.accounts.agent.key();
        policy.max_daily_spend = max_daily_spend;
        policy.spent_today = 0;
        policy.last_reset = Clock::get()?.unix_timestamp;
        policy.approved_merchants = approved_merchants;
        policy.expiry = expiry;
        policy.is_active = true;
        policy.bump = ctx.bumps.policy_account;

        msg!(
            "Policy created: {} lamports/day, {} merchants",
            max_daily_spend,
            policy.approved_merchants.len()
        );
        Ok(())
    }

    /// Update an existing policy. Owner-only.
    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        max_daily_spend: Option<u64>,
        approved_merchants: Option<Vec<Pubkey>>,
        expiry: Option<i64>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy_account;

        if let Some(limit) = max_daily_spend {
            require!(limit > 0, ApplError::InvalidAmount);
            policy.max_daily_spend = limit;
        }
        if let Some(merchants) = approved_merchants {
            require!(merchants.len() <= MAX_MERCHANTS, ApplError::TooManyMerchants);
            policy.approved_merchants = merchants;
        }
        if let Some(exp) = expiry {
            policy.expiry = exp;
        }
        if let Some(active) = is_active {
            policy.is_active = active;
        }

        msg!("Policy updated");
        Ok(())
    }

    /// Revoke a policy (set is_active = false). Owner-only.
    pub fn revoke_policy(ctx: Context<RevokePolicy>) -> Result<()> {
        ctx.accounts.policy_account.is_active = false;
        msg!("Policy revoked");
        Ok(())
    }

    /// The core instruction: validate policy constraints, transfer SOL, log payment.
    /// Signed by the agent keypair — user never touches this transaction.
    pub fn execute_constrained_payment(
        ctx: Context<ExecuteConstrainedPayment>,
        amount: u64,
        nonce: u64,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy_account;
        let clock = Clock::get()?;

        // 1. Policy must be active
        require!(policy.is_active, ApplError::PolicyInactive);

        // 2. Policy must not be expired
        require!(
            clock.unix_timestamp < policy.expiry,
            ApplError::PolicyExpired
        );

        // 3. Reset daily spend counter if 24h have elapsed
        if clock.unix_timestamp - policy.last_reset >= SECONDS_PER_DAY {
            policy.spent_today = 0;
            policy.last_reset = clock.unix_timestamp;
        }

        // 4. Recipient must be an approved merchant
        let recipient_key = ctx.accounts.recipient.key();
        require!(
            policy.approved_merchants.contains(&recipient_key),
            ApplError::MerchantNotApproved
        );

        // 5. Amount must not exceed remaining daily allowance
        require!(amount > 0, ApplError::InvalidAmount);
        require!(
            policy.spent_today.saturating_add(amount) <= policy.max_daily_spend,
            ApplError::SpendLimitExceeded
        );

        // 6. Transfer SOL from agent wallet to recipient via CPI
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.agent.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;

        // 7. Update daily spend tracker
        policy.spent_today += amount;

        // 8. Record payment (immutable audit log)
        let record = &mut ctx.accounts.payment_record;
        record.policy = policy.key();
        record.payer = ctx.accounts.agent.key();
        record.recipient = recipient_key;
        record.amount = amount;
        record.timestamp = clock.unix_timestamp;
        record.nonce = nonce;
        record.bump = ctx.bumps.payment_record;

        msg!(
            "Payment approved: {} lamports to {} | spent today: {}/{}",
            amount,
            recipient_key,
            policy.spent_today,
            policy.max_daily_spend
        );
        Ok(())
    }
}

// ─── Account Structs ─────────────────────────────────────────────────────────

#[account]
#[derive(Default)]
pub struct AgentIdentity {
    pub authority: Pubkey,    // 32
    pub name: String,         // 4 + 32
    pub service_url: String,  // 4 + 128
    pub fee_lamports: u64,    // 8
    pub total_earned: u64,    // 8
    pub is_active: bool,      // 1
    pub bump: u8,             // 1
}

impl AgentIdentity {
    pub const LEN: usize = 8 + 32 + (4 + MAX_NAME_LEN) + (4 + MAX_URL_LEN) + 8 + 8 + 1 + 1;
}

#[account]
pub struct PolicyAccount {
    pub owner: Pubkey,                       // 32
    pub agent: Pubkey,                       // 32
    pub max_daily_spend: u64,                // 8
    pub spent_today: u64,                    // 8
    pub last_reset: i64,                     // 8
    pub approved_merchants: Vec<Pubkey>,     // 4 + (32 * MAX_MERCHANTS)
    pub expiry: i64,                         // 8
    pub is_active: bool,                     // 1
    pub bump: u8,                            // 1
}

impl PolicyAccount {
    pub const LEN: usize =
        8 + 32 + 32 + 8 + 8 + 8 + (4 + 32 * MAX_MERCHANTS) + 8 + 1 + 1;
}

#[account]
pub struct PaymentRecord {
    pub policy: Pubkey,    // 32
    pub payer: Pubkey,     // 32
    pub recipient: Pubkey, // 32
    pub amount: u64,       // 8
    pub timestamp: i64,    // 8
    pub nonce: u64,        // 8
    pub bump: u8,          // 1
}

impl PaymentRecord {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
}

// ─── Instruction Contexts ────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(name: String, service_url: String)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = AgentIdentity::LEN,
        seeds = [b"agent", authority.key().as_ref()],
        bump
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: this is the agent wallet pubkey being governed by the policy
    pub agent: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = PolicyAccount::LEN,
        seeds = [b"policy", owner.key().as_ref(), agent.key().as_ref()],
        bump
    )]
    pub policy_account: Account<'info, PolicyAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"policy", owner.key().as_ref(), policy_account.agent.as_ref()],
        bump = policy_account.bump,
        constraint = policy_account.owner == owner.key() @ ApplError::Unauthorized
    )]
    pub policy_account: Account<'info, PolicyAccount>,
}

#[derive(Accounts)]
pub struct RevokePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"policy", owner.key().as_ref(), policy_account.agent.as_ref()],
        bump = policy_account.bump,
        constraint = policy_account.owner == owner.key() @ ApplError::Unauthorized
    )]
    pub policy_account: Account<'info, PolicyAccount>,
}

#[derive(Accounts)]
#[instruction(amount: u64, nonce: u64)]
pub struct ExecuteConstrainedPayment<'info> {
    /// The agent keypair signs this transaction — not the user's wallet.
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"policy", policy_account.owner.as_ref(), agent.key().as_ref()],
        bump = policy_account.bump,
        constraint = policy_account.agent == agent.key() @ ApplError::Unauthorized
    )]
    pub policy_account: Account<'info, PolicyAccount>,

    /// CHECK: recipient is validated against approved_merchants list in the instruction
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init,
        payer = agent,
        space = PaymentRecord::LEN,
        seeds = [b"payment", policy_account.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub payment_record: Account<'info, PaymentRecord>,

    pub system_program: Program<'info, System>,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum ApplError {
    #[msg("Policy is inactive")]
    PolicyInactive,
    #[msg("Policy has expired")]
    PolicyExpired,
    #[msg("Recipient is not an approved merchant")]
    MerchantNotApproved,
    #[msg("Transaction would exceed the daily spend limit")]
    SpendLimitExceeded,
    #[msg("Caller is not authorized")]
    Unauthorized,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Too many merchants — max 10")]
    TooManyMerchants,
    #[msg("Name too long — max 32 characters")]
    NameTooLong,
    #[msg("URL too long — max 128 characters")]
    UrlTooLong,
}
