terraform {
  required_version = ">= 1.10"

  # ONE state for everything (permanent resources + the nightly platform). The
  # bucket is account-scoped, so it is passed at init time by scripts/tf-init.sh:
  #   terraform init -backend-config="bucket=eventide-tfstate-<account>"
  # use_lockfile = true → S3 conditional-write locking, no DynamoDB table.
  backend "s3" {
    key          = "eventide/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.0"
    }
  }
}
