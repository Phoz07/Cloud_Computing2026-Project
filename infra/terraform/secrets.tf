# Long-lived third-party credentials for the deployed app — Stripe and Gmail.
# Each is optional and fully Terraform-managed from a gitignored *.auto.tfvars,
# the same pattern as the Google OAuth client in oauth.tf. Absent = the feature
# is off: payment refuses checkout without a Stripe key, mail-worker logs mail
# instead of sending it without Gmail. scripts/deploy.sh reads whichever exist
# into the eventide-payment / eventide-mail-worker k8s Secrets each session.
#
# There is deliberately no per-service "runtime env" secret any more (v1 kept
# eventide/<svc> placeholders for ESO): the only generated secrets live in
# the platform module's eventide/rds-master, rebuilt nightly (SYSTEM-DESIGN §5.2.1).

variable "stripe_secret_key" {
  description = "Stripe sandbox key — rk_test_… (restricted, recommended) or sk_test_…. Empty = payment disabled."
  type        = string
  default     = ""
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Signing secret (whsec_…) of the webhook endpoint https://<domain>/api/payment/webhook."
  type        = string
  default     = ""
  sensitive   = true
}

variable "gmail_user" {
  description = "Gmail address the mail worker sends from. Empty = dry-run (mail is logged)."
  type        = string
  default     = ""
}

variable "gmail_app_password" {
  description = "16-char Gmail App Password for gmail_user (needs 2-Step Verification)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "mail_from" {
  description = "Optional From header, e.g. \"Eventide <you@gmail.com>\"; defaults to gmail_user."
  type        = string
  default     = ""
}

locals {
  # nonsensitive(): "is it configured" is not a secret, and count/output need a plain bool.
  stripe_enabled = nonsensitive(var.stripe_secret_key != "")
  gmail_enabled  = nonsensitive(var.gmail_user != "" && var.gmail_app_password != "")
}

resource "aws_secretsmanager_secret" "stripe" {
  count                   = local.stripe_enabled ? 1 : 0
  name                    = "${var.project}/stripe"
  description             = "Stripe sandbox key + webhook signing secret for the payment service. Terraform-managed from stripe.auto.tfvars."
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "stripe" {
  count     = local.stripe_enabled ? 1 : 0
  secret_id = aws_secretsmanager_secret.stripe[0].id
  secret_string = jsonencode({
    STRIPE_SECRET_KEY     = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
  })
}

resource "aws_secretsmanager_secret" "gmail" {
  count                   = local.gmail_enabled ? 1 : 0
  name                    = "${var.project}/gmail"
  description             = "Gmail SMTP credentials for the mail worker. Terraform-managed from gmail.auto.tfvars."
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "gmail" {
  count     = local.gmail_enabled ? 1 : 0
  secret_id = aws_secretsmanager_secret.gmail[0].id
  secret_string = jsonencode({
    GMAIL_USER         = var.gmail_user
    GMAIL_APP_PASSWORD = var.gmail_app_password
    MAIL_FROM          = var.mail_from
  })
}
