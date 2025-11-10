# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.8] - 2025-11-10
### Bugfixes
- Remove OutputEncryptionKMSKeyId from Amazon Transcribe StartTranscriptionJob api as alias/aws/s3 is no longer required.

## [4.0.7] - 2025-10-03
### Features
- Auto extract face name from the file name. Strip any ending numbers from the file name, i.e, John Doe 2.jpg would have the name as John Doe instead of John Doe 2.

## [4.0.6] - 2025-09-16
### Bugfixes
- Pinned python package versions for all docker images to avoid dependency issues


## [4.0.5] - 2025-02-07
### Bugfixes
- faiss new version requires swig. Fix the Faiss version to 1.9.0
- update all packages to the latest
- remove computeChecksums flag as it is not used by S3Client
- workaround for data integrity check that fails the multipart upload from browser, https://github.com/aws/aws-sdk-js-v3/issues/6810

## [4.0.4] - 2024-06-25
### Bugfixes
- Fix ingest image error on TIFF (CMYK colorspace) image format.

## [4.0.3] - 2024-06-19
### Bugfixes
- Fix the python numpy v2.0 incompatibility with the current versions of faiss, blip-caption-on-aws, zero-shot-classification, zero-shot-object-detection.


## [4.0.2] - 2024-05-04
### Added
- added Paris (eu-west-3) and Sydney (ap-southeast-2) regions where Anthropic Claude 3 Haiku are available


## [4.0.1] - 2024-04-11
### Bugfixes
- AWS Elemental MediaConvert does not create frameCapture group when s3://[PROXY_BUCKET]/_settings/aioption.json is missing.
- Short form video (5s) fails the analysis.
- Rephrase the Version Compatibility input parameter on the CFN template to be more clear.

### New features
- added Top 5 most relevant tags at the scene level


## [4.0.0] - 2024-03-06
### New features
- Dynamic frame analysis workflow
- Auto face indexing workflow
- Scene and Ad break detection workflow
- GenAI playground with Amazon Bedrock (Anthropic Claude)
- Knowledge graph with Amazon Neptune Serverless
- Option to choose Amazon OpenSearch Serverless Service instead of Amazon OpenSearch Service (cluster)
- Complex search query that supports AND, OR, NOT directives.
- Experimental feature: Shoppable Metadata (Disabled by default). Contact your AWS representative if you are interested in this feature.

### Changes
- Updated lambda function runtime to NodeJS 20.x
- Updated AWS SDK JS to version 3
- Refactored video analysis state machine by introducing new sub-state machines
  - Dynamic frame segmentation state machine
  - Video based detection state machine
  - Frame based detection state machine
  - Custom model detection state machine
  - Analysis Post Process state machine
- Consolidated opensearch indices into a single index to support complex search query

### Added
- An unified state machine status event bus using Amazon EventBridge to consolidate events from various state machines
- A new Amazon DynamoDB table, `faceindexer` to store face id and name mapping
- An `Update Face Indexer` state machine to manage the face indexer logics such as adding, modifying, and removing faces from the face indexer table, opensearch documents, and metadata files on proxy bucket
- A `Graph Indexer` state machine to manage the Amazon Neptune Serverless logics such as adding, modifying, and removing nodes and relationships from the graph database
- Amazon CodeBuild to build and package opensource models into docker images and store in a private Amazon Elastic Container Registry (Amazon ECR)
  - CLIP, opensource zero shot image classification model running in containerized lambda function for generating image embeddings, used for scene detection feature
  - Faiss, opensource vector store running in containerized lambda funciton for similarity search (stateless), used for scene detection feature
  - OWL-ViT, opensource zero-shot object detection model running in containerized lambda function for apparel detection, used for shoppale metadata feature
  - BLIP, opensource text to caption model running in containerized lambda function for generating image caption, used for image analysis
- Private VPC for the Amazon Neptune Serverless instance

### Removed
- Amazon Rekognition Person Pathing API


## [3.1.5] - 2023-11-02

### Security

- Security updates

### Added

- solution-manifest.yaml file
- package-lock.json files

## [3.1.4] - 2023-09-05

### Changed
 
- Updated backend to Nodejs 16

### Fixed

- #20 [Incorrect reading of a parameter in the "deploy-s3-dist.sh" script](https://github.com/aws-solutions/media2cloud-on-aws/issues/20)
- #23 [Tutorial : Create M2C Stack](https://github.com/aws-solutions/media2cloud-on-aws/issues/23)
- #31 [Corrected some minor writing errors.](https://github.com/aws-solutions/media2cloud-on-aws/pull/31)
- #34 [Fixed PDF to PNG Conversion.](https://github.com/aws-solutions/media2cloud-on-aws/issues/34)

## [3.1.3] - 2023-08-01
- Fixed an issue where media analysis result is not visible in the web application

## [3.1.2] - 2023-04-20
- Updated object ownership configuration on the S3 buckets. 
- Deploying previous versions of the solution will fail due to Amazon S3 security changes. More info on this [blog](https://aws.amazon.com/blogs/aws/heads-up-amazon-s3-security-changes-are-coming-in-april-of-2023/)

## [3.1.1] - 2023-04-3
### Added
- Added package-lock.json files to all lambda packages. 

## [3.1.0] - 2023-02-28
### Added
- AppRegistry integration
- SonarQube properties file

### Changed
- Code fixes for SonarQube
- CloudFormation Stack Update is not supported when upgrading from v3.0.0 to v3.1.0. A new stack must be deployed.

### Contributors
* @sandimciin
* @eggoynes

## [3.0.0] - 2022-02-01
### Added
- Amazon Rekognition Custom Labels model support
- Amazon Rekognition Segment API support
- Amazon Rekognition Text detection for video
- Amazon Transcribe Custom Vocabulary and Custom Language Model support
- Amazon Comprehend Custom Entity Recognizer support
- Support audio and document files
- Frame based analysis
- Backlog queuing mangagement system
- Rewrite backend state machines to use Nested state machine and Map state to simplify workflow
- Enable AWS-XRAY tracing on all AWS Lambda functions

### Changed
- Updated search engine to Amazon OpenSearch 1.0
- Redesigned UI/UX to enable different type of collections
- Advanced search feature to pinpoint timestamps of the search results

### Removed
- Removed Amazon SageMaker Ground Truth Labeling workflow for face indexing


## [2.0.1] - 2019-12-13
### Added
- added additional Comprehend and Transcribe languages support to Media2Cloud

### Changed
- workaround audio analysis issue when Comprehend result contains leading punctuation characters.

### Removed

## [2.0.0] - 2019-10-17
### Added
- Backend: new analysis engine with analysis-monitor, audio-analysis, video-analysis, image-analysis state machines
- Backend: Image support (JPG, PNG, BMP, and selective RAW images), ability to extract EXIF, GPS, XMP information
- Backend: enhance analysis detection
- Backend: server side md5 checksum
- Backend: auto restore object from GLACIER, DEEP_ARCHIVE storage
- AIML: Celebrity detection
- AIML: Face Matching with your own face collection
- AIML: Label detection
- AIML: Moderation detection
- AIML: Person pathing
- AIML: Text detection on image
- AIML: Transcription (subtitle) generation
- AIML: Entity detection
- AIML: Keyphrase detection
- AIML: Sentiment detection
- AIML: Topic detection
- UI: support cropping image and index faces to Amazon Rekognition Face Collection
- UI: Ability to index face and store to your own face collection
- UI: Ability to adjust the confidence level of the detection
- UI: Ability to enable and disable specific detection
- UI: Ability to set language for Speech to Text and NLP processing
- UI: AWS SageMaker Ground Truth integration allows you to create and manage your private work team and crowd source your labeling tasks
- UI: Ability to set pagination to limit each query
- UI: Parse JSON definition file and can ingest multiple files defined in the JSON file
- UI: Player now shows markers of labels being detected
- ES: Enhanced Elasticsearch engine, index all mediainfo, exif, and AIML metadata that allows you to do deep search
- API: Simple APIs to ingest, analyze, and search content

### Changed
- replace Media Analysis solution analysis engine with new analysis engine

### Removed

## [1.0.0] - 2019-01-16
### Added
- initial checkin

### Changed

### Removed