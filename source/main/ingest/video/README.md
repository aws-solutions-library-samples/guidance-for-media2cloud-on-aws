# Video Ingest State Machine

Video Ingest state machine uses AWS Elemental MediaConvert to convert the incoming video file into MP4 file, create thumbnail, and frame extraction if you opt to use frame-based analysis and/or Amazon Rekognition Custom Labels feature.

Please check the details of [the supported input video codec and container](https://docs.aws.amazon.com/mediaconvert/latest/ug/reference-codecs-containers-input.html#reference-codecs-containers-input-video).

![Video Ingest state machine](../../../../deployment/tutorials/images/state-machine-ingest-video.png)

__

* **Run mediainfo** state extracts media technical metadata from the video file
* **Start and wait for mediaconvert job** state uses AWS Elemental MediaConvert to convert the input video into MP4 format, create thumbnail and frame captures. Media2Cloud uses [Amazon CloudWatch Event, MediaConvert Job State Change](https://docs.aws.amazon.com/mediaconvert/latest/ug/mediaconvert_cwe_events.html) to _signal_ back to the state machine execution when a job is completed

__

Back to [Ingest State Machine](../main/README.md) | Back to [README](../../../../README.md)
