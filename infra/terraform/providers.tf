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

# Helm authenticates with a token fetched AT CONNECT TIME via `aws eks get-token`
# (exec plugin). A data "aws_eks_cluster_auth" token is minted early in the apply
# and expires after 15 minutes — EKS + RDS + the node group take longer, so the
# first `make up` hit the API with a stale token (401). The exec plugin inherits
# the credentials from infra/aws.env; the aws CLI must be on PATH.
# helm provider v3: `kubernetes` is an attribute (`= {`), not a nested block.
# Empty host while platform = false — no helm_release exists then, so the
# provider is never asked to connect.
provider "helm" {
  kubernetes = {
    host                   = try(module.platform[0].cluster_endpoint, "")
    cluster_ca_certificate = try(base64decode(module.platform[0].cluster_ca), "")
    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", try(module.platform[0].cluster_name, var.project), "--region", var.region]
    }
  }
}
