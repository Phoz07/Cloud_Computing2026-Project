# Consumed by 20-platform (via terraform_remote_state or -var), by scripts/deploy.sh,
# and by the ESO ClusterSecretStore config.

output "account_id" {
  value = var.account_id
}

output "region" {
  value = var.region
}

output "ecr_registry" {
  description = "Registry host — prefix for every image push/pull."
  value       = "${var.account_id}.dkr.ecr.${var.region}.amazonaws.com"
}

output "ecr_repository_urls" {
  description = "Full push/pull URL per service."
  value       = { for k, r in aws_ecr_repository.service : k => r.repository_url }
}

output "uploads_bucket" {
  description = "S3 bucket for uploaded files (avatars, event covers/assets); public/* is readable, served as /files/* by the ingress."
  value       = data.aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  value = data.aws_s3_bucket.uploads.arn
}

output "mail_queue_url" {
  description = "SQS queue URL for @app/mail — deploy.sh puts it in the eventide-common k8s Secret as MAIL_QUEUE_URL."
  value       = aws_sqs_queue.mail.url
}


# --- Custom domain (dns.tf) — consumed by 20-platform via terraform_remote_state.
# All empty / [] when dns_domain is unset.

output "public_host" {
  description = "Single host the deployed system is served at, e.g. events.example.com."
  value       = local.zone_name
}

output "public_url" {
  description = "https://<public_host> — feed to deploy.sh as PUBLIC_URL (JWT iss/aud, BETTER_AUTH_URL)."
  value       = local.dns_enabled ? "https://${local.zone_name}" : ""
}

output "route53_zone_id" {
  description = "Hosted zone ID — 20-platform adds the NLB ALIAS record here each rebuild."
  value       = local.dns_enabled ? aws_route53_zone.app[0].zone_id : ""
}

output "route53_name_servers" {
  description = "Paste these 4 NS records into Cloudflare for the delegated subdomain, once."
  value       = local.dns_enabled ? aws_route53_zone.app[0].name_servers : []
}

output "acm_certificate_arn" {
  description = "Wildcard cert ARN for the NLB TLS listener (20-platform/nlb.tf). PENDING_VALIDATION until the NS delegation is live."
  value       = local.dns_enabled ? aws_acm_certificate.app[0].arn : ""
}

output "google_oauth_secret" {
  description = "Secrets Manager name holding the Google OAuth client id/secret, or \"\" when Google sign-in is disabled. scripts/deploy.sh reads it into eventide-auth."
  value       = local.google_oauth_enabled ? "${var.project}/google-oauth" : ""
}

output "stripe_secret" {
  description = "Secrets Manager name holding STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET, or \"\" when payment is disabled. deploy.sh reads it into eventide-payment."
  value       = local.stripe_enabled ? "${var.project}/stripe" : ""
}

output "gmail_secret" {
  description = "Secrets Manager name holding GMAIL_USER / GMAIL_APP_PASSWORD / MAIL_FROM, or \"\" when mail runs dry. deploy.sh reads it into eventide-mail-worker."
  value       = local.gmail_enabled ? "${var.project}/gmail" : ""
}
