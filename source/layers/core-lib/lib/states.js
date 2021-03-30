/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
module.exports = {
  /* ingest */
  S3: 's3',
  CreateRecord: 'create-record',
  /* fixity state machine */
  CheckRestoreStatus: 'check-restore-status',
  ComputeChecksum: 'compute-checksum',
  ValidateChecksum: 'validate-checksum',
  FixityCompleted: 'fixity-completed',
  /* mediainfo */
  RunMediainfo: 'run-mediainfo',
  StartTranscode: 'start-transcode',
  CheckTranscodeStatus: 'check-transcode-status',
  /* imageinfo */
  RunImageInfo: 'run-imageinfo',
  /* docinfo */
  RunDocInfo: 'run-docinfo',
  /* indexing */
  UpdateRecord: 'update-record',
  IndexIngestResults: 'index-ingest-results',

  /* analysis */
  PrepareAnalysis: 'prepare-analysis',
  StartAnalysis: 'start-analysis',
  CheckAnalysisStatus: 'check-analysis-status',
  CollectAnalysisResults: 'collect-analysis-results',
  IndexAnalysisResults: 'index-analysis-results',

  /* sub-states definitions */
  /* audio-analysis */
  UpdateVocabulary: 'update-vocabulary',
  CheckVocabularyStatus: 'check-vocabulary-status',
  StartTranscribe: 'start-transcribe',
  CollectTranscribeResults: 'collect-transcribe-results',
  CreateSubtitle: 'create-subtitle',

  StartEntity: 'start-entity',
  CheckEntityStatus: 'check-entity-status',
  CollectEntityResults: 'collect-entity-results',
  CreateEntityTrack: 'create-entity-track',

  CheckCustomEntityCriteria: 'check-custom-entity-criteria',
  StartCustomEntity: 'start-custom-entity',
  CheckCustomEntityStatus: 'check-custom-entity-status',
  CollectCustomEntityResults: 'collect-custom-entity-results',
  CreateCustomEntityTrack: 'create-custom-entity-track',

  StartKeyphrase: 'start-keyphrase',
  CheckKeyphraseStatus: 'check-keyphrase-status',
  CollectKeyphraseResults: 'collect-keyphrase-results',
  CreateKeyphraseTrack: 'create-keyphrase-track',

  StartSentiment: 'start-sentiment',
  CheckSentimentStatus: 'check-sentiment-status',
  CollectSentimentResults: 'collect-sentiment-results',
  CreateSentimentTrack: 'create-sentiment-track',

  StartTopic: 'start-topic',
  CheckTopicStatus: 'check-topic-status',
  CollectTopicResults: 'collect-topic-results',
  CreateTopicTrack: 'create-topic-track',

  StartClassification: 'start-classification',
  CheckClassificationStatus: 'check-classification-status',
  CollectClassificationResults: 'collect-classification-results',
  CreateClassificationTrack: 'create-classification-track',

  /* video analysis */
  StartCelebrity: 'start-celeb',
  CollectCelebrityResults: 'collect-celeb-results',
  CreateCelebrityTrack: 'create-celeb-track',

  StartFace: 'start-face',
  CollectFaceResults: 'collect-face-results',
  CreateFaceTrack: 'create-face-track',

  StartFaceMatch: 'start-face-match',
  CollectFaceMatchResults: 'collect-face-match-results',
  CreateFaceMatchTrack: 'create-face-match-track',

  StartLabel: 'start-label',
  CollectLabelResults: 'collect-label-results',
  CreateLabelTrack: 'create-label-track',

  StartModeration: 'start-moderation',
  CollectModerationResults: 'collect-moderation-results',
  CreateModerationTrack: 'create-moderation-track',

  StartPerson: 'start-person',
  CollectPersonResults: 'collect-person-results',
  CreatePersonTrack: 'create-person-track',

  StartSegment: 'start-segment',
  CollectSegmentResults: 'collect-segment-results',
  CreateSegmentTrack: 'create-segment-track',

  StartText: 'start-text',
  CollectTextResults: 'collect-text-results',
  CreateTextTrack: 'create-text-track',

  /* image analysis */
  StartImageAnalysis: 'start-image-analysis',
  CollectImageAnalysisResults: 'collect-image-analysis-results',

  /* document analysis */
  StartDocumentText: 'start-document-text',
  CheckDocumentTextStatus: 'check-document-text-status',
  CollectDocumentTextResults: 'collect-document-text-results',
  StartDocumentAnalysis: 'start-document-analysis',
  CheckDocumentAnalysisStatus: 'check-document-analysis-status',
  CollectDocumentAnalysisResults: 'collect-document-analysis-results',

  /* frame based analysis */
  DetectFrames: 'detect-frames',
  CreateTracks: 'create-tracks',

  /** NEW IMPLEMENTATION */
  /** NEW IMPLEMENTATION */
  /* frame-based iterator */
  PrepareFrameDetectionIterators: 'prepare-frame-detection-iterators',
  DetectFrameIterator: 'detect-frame-iterator',
  PrepareFrameTrackIterators: 'prepare-frame-track-iterators',
  /* video-based iterator */
  PrepareVideoDetectionIterators: 'prepare-video-detection-iterators',
  /* custom-label iterator */
  PrepareCustomDetectionIterators: 'prepare-custom-detection-iterators',
  /* shared */
  StartDetectionIterator: 'start-detection-iterator',
  CollectResultsIterator: 'collect-results-iterator',
  CreateTrackIterator: 'create-track-iterator',
  /** NEW IMPLEMENTATION */
  /** NEW IMPLEMENTATION */

  /* custom labels */
  StartCustomLabels: 'start-custom-labels',
  CollectCustomLabelsResults: 'collect-custom-labels-results',
  CreateCustomLabelsTrack: 'create-custom-labels-track',

  /* groundtruth */
  CreateDataset: 'create-dataset',
  CreateLabelingJob: 'create-labeling-job',
  CheckLabelingStatus: 'check-labeling-status',
  IndexResults: 'index-results',

  /* shared states */
  JobCompleted: 'job-completed',
};
