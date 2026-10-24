# Uploaded files: avatars, event covers, event gallery assets. v2 uploads go
# THROUGH the owning service as multipart (packages/storage, Bun's S3 client with
# the session creds deploy.sh injects); the browser reads them back as
# `/files/<key>`, which ingress-nginx rewrites to this bucket (infra/helm/eventide/
# templates/files.yaml). Keys are `public/<users|events>/<id>/<folder>/<uuid>`, and
# only `public/*` is anonymously readable (the policy below) — every other prefix
# stays private.
#
# --- why the bucket is not an `aws_s3_bucket` resource -----------------------
# The Learner Lab service control policy (p-lfgm2hv3) explicitly denies
# `s3:GetBucketObjectLockConfiguration`. The AWS provider calls that API on every
# read of an `aws_s3_bucket` resource, so managing the bucket that way makes
# every `plan`/`apply` fail. Probed 2026-09-07; it is the ONLY blocked S3 read.
#
# Workaround: create the bucket with the CLI (idempotent, via terraform_data so
# `terraform apply` is still the single entry point) and manage all of its
# *configuration* through the granular `aws_s3_bucket_*` resources below, which
# use targeted APIs the SCP permits. Report talking point: a probed environment
# constraint that pushed one line of provisioning out of the provider while
# keeping the whole configuration in IaC.

resource "terraform_data" "uploads_bucket" {
  triggers_replace = [local.uploads_bucket, var.region]

  provisioner "local-exec" {
    command = <<-EOT
      aws s3api head-bucket --bucket ${local.uploads_bucket} 2>/dev/null \
        || aws s3api create-bucket --bucket ${local.uploads_bucket} --region ${var.region}
    EOT
  }
}

data "aws_s3_bucket" "uploads" {
  bucket     = local.uploads_bucket
  depends_on = [terraform_data.uploads_bucket]
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = data.aws_s3_bucket.uploads.id

  # ACLs stay blocked (BucketOwnerEnforced below). Public *policies* are allowed
  # so the `public/*` read policy applies — the only public surface of the bucket.
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

# Disable ACLs entirely — access is policy-based (public/* read) or IAM (the services).
resource "aws_s3_bucket_ownership_controls" "uploads" {
  bucket = data.aws_s3_bucket.uploads.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = data.aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Anyone may read public/* (avatars, event images); nothing else. Mirrors the
# minio-init policy in docker-compose.yml. Checked by `bash scripts/check-lab.sh`
# (account-level Public Access Block); fallback if public policies are denied:
# stream /files/* through the event service (spec D6).
resource "aws_s3_bucket_policy" "uploads_public_prefix" {
  bucket = data.aws_s3_bucket.uploads.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadPublicPrefix"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${data.aws_s3_bucket.uploads.arn}/public/*"
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

# Files are disposable (the DB is rebuilt every session); no versioning.
# Clean up multipart uploads a service abandons mid-PUT.
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = data.aws_s3_bucket.uploads.id

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
