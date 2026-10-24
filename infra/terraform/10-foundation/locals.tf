locals {
  # Bucket names must be globally unique — suffix with the account ID.
  uploads_bucket = "${var.project}-uploads-${var.account_id}"
}
