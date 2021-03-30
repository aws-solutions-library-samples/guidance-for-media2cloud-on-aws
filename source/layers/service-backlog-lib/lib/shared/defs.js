module.exports = {
  EventBridge: {
    Bus: process.env.ENV_BACKLOG_EB_BUS,
    Name: 'StatusChange',
    Source: 'custom.servicebacklog',
    DetailType: 'Service Backlog Status Change',
  },
  DynamoDB: {
    Name: process.env.ENV_BACKLOG_TABLE,
    PartitionKey: 'id',
    SortKey: 'serviceApi',
    GSI: {
      Status: {
        Index: 'gsi-status-timestamp',
        PartitionKey: 'status',
        SortKey: 'timestamp',
      },
      JobId: {
        Index: 'gsi-jobId',
        PartitionKey: 'jobId',
      },
    },
    AtomicLock: {
      Name: process.env.ENV_ATOMICLOCK_TABLE,
      PartitionKey: 'lockId',
    },
  },
  DataAccess: {
    RoleArn: process.env.ENV_DATA_ACCESS_ROLE,
  },
  MediaConvert: {
    Endpoint: process.env.ENV_MEDIACONVERT_HOST,
  },
  Topic: {
    Arn: process.env.ENV_BACKLOG_TOPIC_ARN,
    RoleArn: process.env.ENV_BACKLOG_TOPIC_ROLE_ARN,
  },
  StateMachines: {
    BacklogCustomLabels: `${process.env.ENV_SOLUTION_ID}-${process.env.ENV_STACKNAME}-backlog-custom-labels`,
    States: {
      CheckProjectVersionStatus: 'check-project-version-status',
      StartProjectVersion: 'start-project-version',
      DetectCustomLabels: 'detect-custom-labels',
    },
  },
};
