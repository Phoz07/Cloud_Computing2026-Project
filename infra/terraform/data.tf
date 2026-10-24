# The account comes from the credentials in infra/aws.env — nothing is hardcoded,
# so a teammate's Learner Lab account works unchanged (bucket names and the ECR
# registry host are derived from it).
data "aws_caller_identity" "current" {}
