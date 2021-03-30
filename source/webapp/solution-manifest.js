const SolutionManifest = {
  "S3": {
    "UseAccelerateEndpoint": true
  },
  "IotHost": "a1ulhsvsaq5q38-ats.iot.eu-west-1.amazonaws.com",
  "StateMachines": {
    "Ingest": "SO0050-v3a28-ingest-main",
    "Analysis": "SO0050-v3a28-analysis-main",
    "Main": "SO0050-v3a28-main"
  },
  "ApiEndpoint": "https://n52zlnnv73.execute-api.eu-west-1.amazonaws.com/demo",
  "IotTopic": "SO0050-v3a28/status",
  "Proxy": {
    "Bucket": "so0050-v3a28-3e1da75ac746-proxy"
  },
  "Ingest": {
    "Bucket": "so0050-v3a28-3e1da75ac746-ingest"
  },
  "SolutionId": "SO0050",
  "Version": "v3a28p10",
  "Region": "eu-west-1",
  "LastUpdated": "2021-01-04T15:09:54.566Z",
  "Cognito": {
    "UserPoolId": "eu-west-1_l8BZ2l5if",
    "ClientId": "2g11p31eaiiah8m0sc6livr7s8",
    "IdentityPoolId": "eu-west-1:54d9e851-de3c-49a9-8856-e0eb4296f86b",
    "RedirectUri": "https://d23qak7ylgqq3q.cloudfront.net"
  },
  "StackName": "v3a28",
  "AIML": {
    "celeb": true,
    "face": true,
    "facematch": true,
    "label": true,
    "moderation": true,
    "person": true,
    "text": true,
    "segment": true,
    "customlabel": false,
    "minConfidence": 80,
    "customLabelModels": [],
    "frameCaptureMode": 0,
    "textROI": [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ],
    "framebased": false,
    "transcribe": true,
    "keyphrase": true,
    "entity": true,
    "sentiment": true,
    "topic": false,
    "classification": false,
    "textract": true
  },
  "ApiOps": {
    "Assets": "assets",
    "Analysis": "analysis",
    "Labeling": "labeling",
    "Workteam": "workteam",
    "FaceCollection": "face-collection",
    "IndexFace": "index-face",
    "QueueFace": "queue-face",
    "Search": "search",
    "Execution": "execution",
    "AttachPolicy": "attach-policy",
    "EditLabel": "edit-label",
    "FaceCollections": "rekognition/face-collections",
    "CustomLabelModels": "rekognitin/custom-label-models",
    "CustomVocabularies": "transcribe/custom-vocabularies",
    "CustomLanguageModels": "transcribe/custom-language-models",
    "CustomEntityRecognizers": "comprehend/custom-entity-recognizers",
    "Stats": "stats"
  },
  "Statuses": {
    "Processing": "PROCESSING",
    "Completed": "COMPLETED",
    "Error": "ERROR",
    "None": "NONE",
    "NotStarted": "NOT_STARTED",
    "Started": "STARTED",
    "InProgress": "IN_PROGRESS",
    "NoData": "NO_DATA",
    "Removed": "REMOVED",
    "IngestStarted": "INGEST_STARTED",
    "IngestCompleted": "INGEST_COMPLETED",
    "IngestError": "INGEST_ERROR",
    "AnalysisStarted": "ANALYSIS_STARTED",
    "AnalysisCompleted": "ANALYSIS_COMPLETED",
    "AnalysisError": "ANALYSIS_ERROR"
  },
  "FrameCaptureMode": {
    "MODE_NONE": 0,
    "MODE_1FPS": 1,
    "MODE_2FPS": 2,
    "MODE_3FPS": 3,
    "MODE_4FPS": 4,
    "MODE_5FPS": 5,
    "MODE_10FPS": 10,
    "MODE_12FPS": 12,
    "MODE_15FPS": 15,
    "MODE_ALL": 1000,
    "MODE_HALF_FPS": 1001,
    "MODE_1F_EVERY_2S": 1002,
    "MODE_1F_EVERY_5S": 1003
  },
  "AnalysisTypes": {
    "Rekognition": {
      "Celeb": "celeb",
      "Face": "face",
      "FaceMatch": "facematch",
      "Label": "label",
      "Moderation": "moderation",
      "Person": "person",
      "Text": "text",
      "Segment": "segment",
      "CustomLabel": "customlabel"
    },
    "Transcribe": "transcribe",
    "Comprehend": {
      "Keyphrase": "keyphrase",
      "Entity": "entity",
      "Sentiment": "sentiment",
      "Topic": "topic",
      "Classification": "classification"
    },
    "Textract": "textract"
  }
};

export default SolutionManifest;
