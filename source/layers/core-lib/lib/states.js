/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * exposes States definition, shared by the backend and frontend
 */
const States = {
  /* ingest */
  S3: 's3',
  CreateRecord: 'create-record',
  /* checksum sub-state machine */
  CheckRestoreStatus: 'check-restore-status',
  ComputeChecksum: 'compute-checksum',
  ValidateChecksum: 'validate-checksum',
  /* mediainfo */
  RunMediainfo: 'run-mediainfo',
  StartTranscode: 'start-transcode',
  CheckTranscodeStatus: 'check-transcode-status',
  /* imageinfo */
  RunImageInfo: 'run-imageinfo',
  /* indexing */
  UpdateRecord: 'update-record',
  IndexIngestResults: 'index-ingest-results',

  /* analysis */
  StartAnalysis: 'start-analysis',
  CheckAnalysisStatus: 'check-analysis-status',
  CollectAnalysisResults: 'collect-analysis-results',
  IndexAnalysisResults: 'index-analysis-results',

  /* sub-states definitions */
  /* audio-analysis */
  UpdateVocabulary: 'update-vocabulary',
  CheckVocabularyStatus: 'check-vocabulary-status',
  StartTranscribe: 'start-transcribe',
  CheckTranscribeStatus: 'check-transcribe-status',
  DownloadTranscripts: 'download-transcripts',
  CreateSubtitle: 'create-subtitle',

  StartEntity: 'start-entity',
  CheckEntityStatus: 'check-entity-status',
  CollectEntityResults: 'collect-entity-results',
  CreateEntityTrack: 'create-entity-track',

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
  CheckCelebrityStatus: 'check-celeb-status',
  CollectCelebrityResults: 'collect-celeb-results',
  CreateCelebrityTrack: 'create-celeb-track',

  StartFace: 'start-face',
  CheckFaceStatus: 'check-face-status',
  CollectFaceResults: 'collect-face-results',
  CreateFaceTrack: 'create-face-track',

  StartFaceMatch: 'start-face-match',
  CheckFaceMatchStatus: 'check-face-match-status',
  CollectFaceMatchResults: 'collect-face-match-results',
  CreateFaceMatchTrack: 'create-face-match-track',

  StartLabel: 'start-label',
  CheckLabelStatus: 'check-label-status',
  CollectLabelResults: 'collect-label-results',
  CreateLabelTrack: 'create-label-track',

  StartModeration: 'start-moderation',
  CheckModerationStatus: 'check-moderation-status',
  CollectModerationResults: 'collect-moderation-results',
  CreateModerationTrack: 'create-moderation-track',

  StartPerson: 'start-person',
  CheckPersonStatus: 'check-person-status',
  CollectPersonResults: 'collect-person-results',
  CreatePersonTrack: 'create-person-track',

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

  /* groundtruth */
  CreateDataset: 'create-dataset',
  CreateLabelingJob: 'create-labeling-job',
  CheckLabelingStatus: 'check-labeling-status',
  IndexResults: 'index-results',

  /* shared states */
  JobCompleted: 'job-completed',
};

module.exports = {
  States,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    States,
  });
