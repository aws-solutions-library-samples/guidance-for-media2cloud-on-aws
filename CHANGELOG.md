# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - TBD
### Added
- optimized state machines by using Step Functions Service Integration to reduce the number of state transitions whenever possible.

### Changed

### Removed

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
