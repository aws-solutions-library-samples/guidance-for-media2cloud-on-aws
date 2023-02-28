const SolutionManifest = {
    "S3": {
      "UseAccelerateEndpoint": true,
      "ExpectedBucketOwner": "111111111111"
    },
    "IotHost": "a2ys8h4dnleiq4-ats.iot.us-west-2.amazonaws.com",
    "StateMachines": {
      "Ingest": "so0050-0a709c9ee415-ingest-main",
      "Analysis": "so0050-0a709c9ee415-analysis-main",
      "Main": "so0050-0a709c9ee415-main"
    },
    "ApiEndpoint": "https://test.execute-api.us-west-2.amazonaws.com/demo",
    "IotTopic": "so0050-0a709c9ee415/status",
    "Proxy": {
      "Bucket": "so0050-0a709c9ee415-111111111111-us-west-2-proxy"
    },
    "Ingest": {
      "Bucket": "so0050-0a709c9ee415-111111111111-us-west-2-ingest"
    },
    "SolutionId": "SO0050",
    "Version": "v3.0.0",
    "Region": "us-west-2",
    "Cognito": {
      "UserPoolId": "us-west-2_KXaPys2Gu",
      "ClientId": "3smf5n7m04jl5sotsp1mtpud39",
      "IdentityPoolId": "us-west-2:b081e92e-a6d4-422d-b456-6594572bed6e",
      "RedirectUri": "https://d3tte2vdm23ihw.cloudfront.net"
    },
    "LastUpdated": "2022-12-02T07:42:53.379Z",
    "CustomUserAgent": "",
    "StackName": "so0050-0a709c9ee415",
    "AIML": {
      "celeb": true,
      "face": false,
      "facematch": false,
      "label": true,
      "moderation": false,
      "person": false,
      "text": false,
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
      "sentiment": false,
      "customentity": false,
      "textract": true
    },
    "ApiOps": {
      "Assets": "assets",
      "Analysis": "analysis",
      "Search": "search",
      "Execution": "execution",
      "AttachPolicy": "attach-policy",
      "FaceCollections": "rekognition/face-collections",
      "FaceCollection": "rekognition/face-collection",
      "Faces": "rekognition/faces",
      "Face": "rekognition/face",
      "CustomLabelModels": "rekognition/custom-label-models",
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
        "CustomEntity": "customentity"
      },
      "Textract": "textract"
    }
  };
  
  export default SolutionManifest;