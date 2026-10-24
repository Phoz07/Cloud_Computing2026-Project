# Credentials come from the environment: infra/aws.env (gitignored; copy of
# infra/aws.env.example with the Learner Lab keys pasted in), sourced by the
# Makefile and every script. Nothing credential-shaped lives in Terraform.
provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "eventide"
      ManagedBy = "terraform"
      Course    = "cloud-computing-2026"
    }
  }
}

# Token is generated client-side from the current AWS credentials (STS) — no
# extra IAM permissions, refreshed on every plan/apply.
data "aws_eks_cluster_auth" "this" {
  count = var.platform ? 1 : 0
  name  = module.platform[0].cluster_name
}

# helm provider v3: `kubernetes` is an attribute (`= {`), not a nested block.
# Empty values while platform = false — no helm_release exists then, so the
# provider is never asked to connect.
provider "helm" {
  kubernetes = {
    host                   = try(module.platform[0].cluster_endpoint, "")
    cluster_ca_certificate = try(base64decode(module.platform[0].cluster_ca), "")
    token                  = try(data.aws_eks_cluster_auth.this[0].token, "")
  }
}
