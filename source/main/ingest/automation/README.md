# Ingest Workflow Status Updater

## State Machine Service Integration

Traditionally when you start a process that takes long time to finish, one common technique is to use a ```for loop``` to periodically check the status of the process (polling) and wait for the process to complete, illustrated in the following diagram.

![Ingest Video Polling State Machine](../../../../deployment/tutorials/images/ingest-video-polling-state-machine.png)

While polling status works fine, it is not optimal approach as it requires resources to periodically wake up and check the status.

The Media2Cloud solution uses an event-driven (async wait) approach using the [Step Functions Service Integration Pattern](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html) where we pause the state machine execution, release the lambda resource, and wait for an _external signal_ to resume the execution. The technique allows us to optimize the use of resources and simplify the workflow. The following diagram demonstrates an event-driven approach.

![Event Driven State Machine](../../../../deployment/tutorials/images/ingest-video-async-state-machine.png)

This techique is used in both [Ingest Video State Machine](../video/README.md) and [Ingest Audio State Machine](../audio/README.md) workflows where an asynchronous wait state operation (starting a mediaconvert job) is implemented. In this chapter, we explain how it is accomplished by exploring the service components involved and walkthrough the connections (wiring) behind the scene.

![State Mahchine Service Integration](../../../../deployment/tutorials/images/ingest-video-service-integration.png)

__

### Service components
* An Amazon DynamoDB table (service-token) is used to store a ```Job ID``` of the transcoding job and a ```state machine execution token``` which is used to communicate back to the state machine execution.
* An Amazon CloudWatch Event Rule (mediaconvert-status-change-event) configures to listen to [MediaConvert Job State Change](https://docs.aws.amazon.com/mediaconvert/latest/ug/mediaconvert_cwe_events.html) event with the status of _COMPLETE_, _CANCELED_, and _ERROR_.
* An AWS Lambda function (ingest-status-updater) is attached to the _mediaconvert-status-change-event_ Event Rule and to send the job result back to the state machine execution.

__

### Walkthrough

To enable the asynchronous wait state in the state machine, we will first configure the state as follows:
```json
{
  "StartAt": "Run mediainfo",
  "States": {
    "Run mediainfo": {
      ...
      "Next": "Start and wait for mediaconvert job",
    },
    "Start and wait for mediaconvert job": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
      "Parameters": {
        "FunctionName": "INGEST_VIDEO_LAMBDA",
        "Payload": {
          "token.$": "$$.Task.Token",
          ...
        }
      },
      "End": true
    }
  }
}
```

In the ```Start and wait for mediaconvert job``` state definition, we specify the _Resource_ to be [arn:aws:states:::lambda:invoke.waitForTaskToken](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-wait-token) that instructs the state machine to wait for a task result to come back before the state should exit. We also set _token.$_ to [$$.Task.Token](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-wait-token) to pass in the unique execution token to the lambda function. The execution token is used to identify the current state machine execution and will be used by an external process to signal back to the current execution.

When the ```Start and wait mediaconvert job``` state executes, a lambda function starts a mediaconvert job by calling [MediaConvert.CreateJob](https://docs.aws.amazon.com/mediaconvert/latest/apireference/jobs.html#jobspost) API in _Step 1_. The response of the API returns a unique Job ID. The lambda function then registers the Job ID and the unique state machine execution token to the service-token DynamoDB table in _Step 2_. At this point, the lambda function exists and the state machine execution is put in a _Pause_ state waiting for the task result to come back.

When the mediaconvert job is completed, it emits [MediaConvert Job State Change](https://docs.aws.amazon.com/mediaconvert/latest/ug/mediaconvert_cwe_events.html) event to Amazon CloudWatch Event in _Step 3_ where our Amazon CloudWatch Event Rule (mediaconvert-status-change-event) invokes a lambda function (ingest-status-updater) to process in _Step 4 and 5_.

The ingest-status-updater lambda function looks up the execution token from the service-token DynamoDB table using the MediaConvert Job ID in _Step 6_. It then calls [StepFunctions.SendTaskSuccess](https://docs.aws.amazon.com/step-functions/latest/apireference/API_SendTaskSuccess.html) API to notify the state machine execution in _Step 7_.

The state machine execution resumes from the _Pause_ state and continues the rest.

____

## Handling changes on Ingest table
[DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html) feature captures data changes in an Amazon DynamoDB table that allows you to react to changes that have been made to a specific table.

The ingest DynamoDB table enables the DynamoDB Stream feature that allows us to react on changes on the ingest table and to enable logics such as cleaning up generated proxies and metadata files when an item has been removed from the table or updating the Amazon OpenSearch indices when certain ingest fields have been modified.

The DynamoDB Stream attaches the ingest-status-updater lambda function which implements the actions.

### On item removed event
When an item has been removed from the ```ingest``` table, the ingest-status-change lambda function removes proxies and metadata files from the Amazon S3 proxy bucket and deletes documents from the Amazon OpenSearch indices. It also deletes corresponding items from the ```aiml``` DynamoDB table.

### On item modified event
When the _status_ or _overallStatus_ field is updated in the ```ingest``` table, the lambda function updates the document in the Amazon OpenSearch indices to refresh the changes.

__

## AWS Lambda function (ingest-status-updater)
The following AWS XRAY trace diagram illustrates the AWS resources this lambda function communicates to.

![Ingest Status Updater Lambda function](../../../../deployment/tutorials/images/ingest-status-updater-lambda.png)

__

## IAM Role Permission

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "states:SendTaskSuccess",
                "states:SendTaskFailure"
            ],
            "Resource": [
                "INGEST_VIDEO_STATE_MACHINE",
                "INGEST_AUDIO_STATE_MACHINE"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:DescribeTable",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": [
                "SERVICE_TOKEN_TABLE",
                "INGEST_TABLE",
                "AIML_TABLE",
            ],
            "Effect": "Allow"
        },
        {
            "Action": "iot:Publish",
            "Resource": "IOT_STATUS_TOPIC",
            "Effect": "Allow"
        },
        {
            "Action": "sns:Publish",
            "Resource": "SNS_STATUS_TOPIC",
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:DescribeStream",
                "dynamodb:GetRecords",
                "dynamodb:GetShardIterator",
                "dynamodb:ListStreams"
            ],
            "Resource": "INGEST_TABLE_DDB_STREAM",
            "Effect": "Allow"
        },
        {
            "Action": "s3:ListBucket",
            "Resource": "PROXY_BUCKET",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "PROXY_BUCKET",
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
            "Resource": [
                "OPENSEARCH_CLUSTER"
            ],
            "Effect": "Allow"
        }
    ]
}
```

__

Back to [Ingest Main State Machine](../main/README.md) | Back to [Table of contents](../../../../README.md#table-of-contents)
