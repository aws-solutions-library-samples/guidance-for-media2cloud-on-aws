# Main State Machine

The main state machine is the entry point for processing files. It is a state machine that executes the ingest process (a child state machine) and then the anlysis process (a child state machine) using [AWS Step Function Nested Workflows](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-nested-workflows.html) technique.

![Main state machine](../../deployment/tutorials/images/state-machine-main.png)

## Main state machine definition

```json
{
    "Comment": "main state machine to run ingest and anlysis sub state machines",
    "StartAt": "Start ingest state machine",
    "States": {
        "Start ingest state machine": {
            "Type": "Task",
            "Resource": "arn:aws:states:::states:startExecution.sync",
            "Parameters": {
                "Input": {
                    "input.$": "$.input"
                },
                "StateMachineArn": "${IngestStateMachine}"
            },
            "ResultSelector": {
                "ingestOutput.$": "States.StringToJson($.Input)"
            },
            "Next": "Start analysis state machine"
        },
        "Start analysis state machine": {
            "Type": "Task",
            "Resource": "arn:aws:states:::states:startExecution.sync",
            "Parameters": {
                "Input": {
                    "uuid.$": "$.ingestOutput.input.uuid",
                    "input.$": "$.ingestOutput.input"
                },
                "StateMachineArn": "${AnalysisStateMachine}"
            },
            "End": true
        }
    }
}
```
__

Next to [Ingest state machine](./ingest/main/README.md) | [Analysis state machine](./analysis/main/README.md) | Back to [README](../../README.md)
