# Image Ingest State Machine

The Image Ingest State Machine contains just one state, Run imageinfo that extracts technical metadata of the uploaded image file and creates a proxy version of the image file.

![Image Ingest state machine](../../../../deployment/tutorials/images/ingest-image-state-machine.png)


#### _State: Run imageinfo_

The lambda funtion uses [ExifTool by Phil Harvey](https://github.com/exiftool/exiftool) to extract EXIF information from the image file and uses [Jimp](https://github.com/oliver-moran/jimp) to create a proxy image in JPEG format. The lambda function stores the EXIF metadata and proxy image to the Amazon S3 proxy bucket and updates the **imageinfo** field in the Amazon DynamoDB ingest table.

__

### AWS Lambda function (ingest-image)

The ingest-image lambda function provides the implementation to support the Ingest Image state machine. It requires permission to access INGEST_BUCKET, PROXY_BUCKET, and INGEST_TABLE.

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
            "Action": "s3:GetObject",
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
        }
    ]
}

```

#### _X-Ray Trace_

The following AWS XRAY trace diagram illustrates the AWS resources this lambda function communicates to.

![Ingest Image Lambda function](../../../../deployment/tutorials/images/ingest-image-lambda.png)

__

Back to [Ingestion Main State Machine](../main/README.md) | Back to [Table of contents](../../../../README.md#table-of-contents)
