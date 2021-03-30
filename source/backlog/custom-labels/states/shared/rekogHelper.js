const AWS = require('aws-sdk');
const {
  Retry,
  BacklogClient: {
    CustomBacklogJob,
  },
} = require('service-backlog-lib');

class RekogHelper {
  static getInstance() {
    return new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
  }

  static async startProjectVersion(params) {
    const rekog = RekogHelper.getInstance();
    const fn = rekog.startProjectVersion.bind(rekog);
    return Retry.run(fn, params, 3);
  }

  static async describeProjectVersion(projectArn, projectVersionArn) {
    const params = {
      ProjectArn: projectArn,
      MaxResults: 1,
      VersionNames: [
        projectVersionArn.split('/')[3],
      ],
    };
    const rekog = RekogHelper.getInstance();
    const fn = rekog.describeProjectVersions.bind(rekog);
    const response = await Retry.run(fn, params, 4);

    while (response.ProjectVersionDescriptions.length) {
      const item = response.ProjectVersionDescriptions.shift();
      if (item.ProjectVersionArn === projectVersionArn) {
        return {
          status: item.Status,
          inferenceUnits: item.MinInferenceUnits,
        };
      }
    }
    return {
      status: 'UNKNOWN',
    };
  }

  static async detectCustomLabels(params) {
    const rekog = RekogHelper.getInstance();
    const fn = rekog.detectCustomLabels.bind(rekog);
    return Retry.run(fn, params, 3);
  }

  static async updateProjectVersionTTL(projectVersionArn, ttl) {
    return CustomBacklogJob.updateTTL(projectVersionArn, ttl);
  }
}

module.exports = RekogHelper;
