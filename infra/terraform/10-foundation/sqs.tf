# The mail queue (@app/mail → apps/mail-worker). Mirrors infra/elasticmq/
# elasticmq.conf, which is what `bun run dev` and k3d use: 30 s visibility,
# 10 s long poll, dead-letter after 5 receives. Permanent layer — queues cost
# nothing at this volume and the URL is stable across platform rebuilds.
#
# Pods authenticate with the lab session credentials scripts/deploy.sh injects
# (no IRSA in the lab — the same path the S3 client uses). If `sqs:CreateQueue`
# turns out denied (`bash scripts/check-lab.sh`), the fallback is an ElasticMQ
# pod in the chart with SQS_ENDPOINT pointed at it (spec D5).

resource "aws_sqs_queue" "mail_dlq" {
  name = "${var.project}-mail-dlq"
}

resource "aws_sqs_queue" "mail" {
  name                       = "${var.project}-mail-queue"
  visibility_timeout_seconds = 30
  receive_wait_time_seconds  = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.mail_dlq.arn
    maxReceiveCount     = 5
  })
}
