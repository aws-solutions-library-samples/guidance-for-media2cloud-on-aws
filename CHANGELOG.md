# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
