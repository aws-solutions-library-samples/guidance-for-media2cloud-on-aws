# Ingest Fixity State Machine

The Ingest Fixity State Machine is a sub-state machine focuses on computing and validating the MD5 checksum of the ingested file. If the file is stored in ```GLACIER``` or ```DEEP_ARCHIVE``` storage class, the state machine temporarily restores the object before the checksum is performed.

![Ingest Fixty state machine](../../../../deployment/tutorials/images/ingest-fixity-state-machine.png)

__

## State: Check restore status
A state where a lambda function uses ```S3.HeadOject``` api to confirm the file is in ```STANDARD``` storage class and can be processed. If the file is in ```GLACIER``` or ```DEEP_ARCHIVE``` storage class, the lamba function call S3.RestoreStore to start the restore process.

__

## State: Check restore status
A state where a lambda function uses ```S3.HeadOject``` api to confirm the file is in ```STANDARD``` storage class and can be processed. If the file is in ```GLACIER``` or ```DEEP_ARCHIVE``` storage class, the lamba function call S3.RestoreStore to start the restore process.

__

## State: Restore completed?
A Choice state that checks _$.status_ flag. If the flag is set to _COMPLETED_ indicating the file is ready to be consumed, transitions to ```Compute Checksum``` state. Otherwise, moves to one of the following Wait states:
* ```Wait 4 mins``` state if _$.data.restore.tier_ is set to Expedited
* ```Wait 12 hrs``` state if _$.data.restore.storageClass_ is set to DEEP_ARCHIVE and _$.data.restore.tier_ is set to Bulk
*  ```Wait 4 hrs``` state for the rest of the conditions.

__

## State: Wait 4 mins
A Wait state to wait for 4 minutes and move back to ```Check restore status``` state.

__

## State: Wait 12 hrs
A Wait state to wait for 12 hours and move back to ```Check restore status``` state.

__

## State: Wait 4 hrs
A Wait state to wait for 4 hours and move back to ```Check restore status``` state.

__

## State: Compute checksum
A state where a lambda function computes MD5 checksum value of the file. The lambda function uses ```S3.GetObject``` byte range to fetch 20GB chunk at a time and computes the incremental MD5 hash value of the chunk, stores the incremental MD5 hash value to the _$.checksum.intermediateHash_ and tranistions to ```More data?``` State.

__

## State: More data?
A Choice state to check _$.status flag_. If it is set to _COMPLETED_ indicating checksum has been computed, move to the next state, ```Validate checksum``` state. Otherwise, re-enters ```Compute checksum``` state to continue the next 20GB chunk of the file.

__

## State: Validate checksum
A state where a lambda function compares and validates the MD5 checksum value we computed ealier against _previously_ computed MD5 checksum value that was stored in the object metadata (```x-amz-metdata-md5```) or in the object tag (```computed-md5```).

__

## AWS Lambda function (ingest-fixity)
The ingest-fixity lambda function provides the implementation to support different states of the Fixity state machine. The following AWS XRAY trace diagram illustrates the AWS resources this lambda function communicates to.

![Ingest Fixity Lambda function](../../../../deployment/tutorials/images/ingest-fixity-lambda.png)

__

## IAM Role Permission

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "s3:GetObject",
                "s3:GetObjectTagging",
                "s3:GetObjectVersionTagging",
                "s3:PutObject",
                "s3:PutObjectTagging",
                "s3:PutObjectVersionTagging",
                "s3:RestoreObject"
            ],
            "Resource": "INGEST_BUCKET",
            "Effect": "Allow"
        }
    ]
}
```

__

Back to [Ingest Main State Machine](../main/README.md) | Back to [Table of contents](../../../../README.md#table-of-contents)
