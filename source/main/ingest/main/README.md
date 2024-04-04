# Ingestion Main State Machine

The Ingestion Main State Machine orchestrates a workflow for ingesting different types of media files (image, video, audio, and document).

![Ingestion Main state machine](../../../../deployment/tutorials/images/ingest-main-state-machine.png)

#### _State: Create record_

The workflow starts with the "Create record" lambda step that create a record in an Amazon DynamoDB table. The record includes the uuid, bucket, key of the S3 object.

#### _State: Start fixity_

Next, a nested state machine "Start fixity" is executed. This nested state machine is responsible for performing fixity checks on the media file.

#### _State: Fixity completed_

After the fixity checks are completed, the "Fixity completed" lambda step is triggered to update the fixity record to the Amazon DynamoDB table and to mark the fixity process as completed.

#### _State: Choose by media type_

The workflow then enters a "Choice" state, where it branches out based on the media type of the file being processed. The possible media types are "image", "video", "audio", and "document".

Depending on the media type, a corresponding nested state machine is invoked. These nested state machines are responsible for ingesting and processing the respective media types (image ingest, video ingest, audio ingest, and document ingest).

#### _State: Start image ingest_

A nested state machine "Start image ingest" is executed. This nested state machine is responsible for ingesting image-type files.

#### _State: Start video ingest_

A nested state machine "Start video ingest" is executed. This nested state machine is responsible for ingesting video-type files.

#### _State: Start audio ingest_

A nested state machine "Start audio ingest" is executed. This nested state machine is responsible for ingesting video-type files.

#### _State: Start document ingest_

A nested state machine "Start document ingest" is executed. This nested state machine is responsible for ingesting video-type files.

#### _State: Update record_

This step updates the record in the data store with the processing status, locations of the technical metadata files (such as MediaInfo), generated proxy files (such as MP4 files), and generated thumbnail images.

#### _State: Index ingest results_

This step indexes the ingest results to the opensearch cluster for search or retrieval purposes.

#### _State: Completed_

This step updates the "completed" status in the data store, sends a notification via Amazon Simple Notification Service (SNS), and marks the ingestion workflow as completed.

#### _State: Media type not supported_

If the media type is not supported or recognized, the workflow transitions to a "Fail" state with the error message "Media type not supported".

__

#### _Execution input_

The state machine execution input is passed through from the [Main State Machine](../../README.md#execution-input).

__

### AWS Lambda function (ingest-main)

The Ingest-Main Lambda function provides the implementation to support the different states of the Ingestion Main state machine. It requires permission to access Amazon S3 buckets, Amazon DynamoDB tables, and Amazon OpenSearch Service.

#### _IAM Role Policy_

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Action": [
				"logs:CreateLogGroup",
				"logs:CreateLogStream",
				"logs:PutLogEvents"
			],
			"Resource": "[CLOUDWATCH_LOGS]",
			"Effect": "Allow"
		},
		{
			"Action": "s3:ListBucket",
			"Resource": "[INGEST_BUCKET]",
			"Effect": "Allow"
		},
		{
			"Action": [
				"s3:GetObject",
				"s3:GetObjectTagging",
				"s3:GetObjectVersionTagging",
				"s3:PutObjectTagging",
				"s3:PutObjectVersionTagging"
			],
			"Resource": "[INGEST_BUCKET]",
			"Effect": "Allow"
		},
		{
			"Action": "s3:ListBucket",
			"Resource": "[PROXY_BUCKET]",
			"Effect": "Allow"
		},
		{
			"Action": [
				"s3:GetObject",
				"s3:PutObject"
			],
			"Resource": "[PROXY_BUCKET]",
			"Effect": "Allow"
		},
		{
			"Action": [
				"dynamodb:Scan",
				"dynamodb:Query",
				"dynamodb:UpdateItem",
				"dynamodb:DeleteItem"
			],
			"Resource": "[INGEST_TABLE]",
			"Effect": "Allow"
		},
		{
			"Action": "iot:Publish",
			"Resource": "[IOT_TOPIC]",
			"Effect": "Allow"
		},
		{
			"Action": [
				"es:ESHttpGet",
				"es:ESHttpHead",
				"es:ESHttpPost",
				"es:ESHttpPut",
				"es:ESHttpDelete"
			],
			"Resource": "[OPENSEARCH_DOMAIN]",
			"Effect": "Allow"
		},
		{
			"Action": "aoss:APIAccessAll",
			"Resource": "[OPENSEARCH_SERVERLESS_COLLECTION]",
			"Effect": "Allow"
		},
		{
			"Action": "sns:Publish",
			"Resource": "[SNS_TOPIC]",
			"Effect": "Allow"
		}
	]
}

```

#### _X-Ray Trace_

The following AWS X-Ray trace diagram demonstrates the AWS services that this Lambda function communicates with.

![Ingestion Main Lambda function](../../../../deployment/tutorials/images/ingest-main-lambda.png)

__

## Next topics

- [Fixity State Machine](../fixity/README.md)
- [Image Ingest State Machine](../image/README.md)
- [Video Ingest State Machine](../video/README.md)
- [Audio Ingest State Machine](../audio/README.md)
- [Document Ingest State Machine](../document/README.md)
- Ingest Status Updater
    - [Using State Machine Service Integration with AWS Elemental MediaConvert service](../automation/README.md#state-machine-service-integration)
    - [Handling changes on Ingest Table using Amazon DynamoDB Streams](../automation/README.md#handling-changes-on-ingest-table)


__

Back to [Main State Machine](../../README.md) | Back to [Table of contents](../../../../README.md#table-of-contents)

