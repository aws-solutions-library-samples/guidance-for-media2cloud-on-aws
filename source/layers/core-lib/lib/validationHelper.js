/* Letter, Punctuation, Number, Currency, and space */
const ALL_CHARACTER_SETS = /[\p{L}\p{P}\p{N}\p{Sc}\s]+/u;

class ValidationHelper {
  /**
   * @static
   * @function validateBucket - validate bucket name
   * @description
   * * must be at least 3 and no more than 63 characters long
   * * must not contain uppercase characters or underscores
   * * must start with a lowercase letter or number
   * * must be a series of one or more labels. Adjacent labels are separated by a single period (.)
   * * must not be formatted as an IP address
   * @param {string} val - bucket name
   */
  static validateBucket(val = '') {
    return !(
      (val.length < 3 || val.length > 63)
      || /[^a-z0-9-.]/.test(val)
      || /^[^a-z0-9]/.test(val)
      || /\.{2,}/.test(val)
      || /^\d+.\d+.\d+.\d+$/.test(val)
    );
  }

  /**
   * @static
   * @function validateUuid - validate uuid
   * @description
   * * must be (hex)[8]-hex(4)-hex(4)-hex(4)-hex(12)
   * @param {string} val - uuid
   */
  static validateUuid(val = '') {
    return (
      /^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(val)
      || /^[a-fA-F0-9]{8,}$/.test(val)
    );
  }

  /**
   * @static
   * @function validateCognitoIdentityId
   * @description cognito identity id is in a form of <region>:<uuid>
   * @param {string} val - id
   */
  static validateCognitoIdentityId(val = '') {
    return /^[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(val);
  }

  /**
   * @static
   * @function validateBase64JsonToken
   * @description dynamodb token is base64 encoded JSON object.
   * @param {string} val
   */
  static validateBase64JsonToken(val = '') {
    /* base64 token must be a JSON object */
    try {
      JSON.parse(Buffer.from(val, 'base64').toString());
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * @static
   * @function validateFaceCollectionId
   * @description face collection Id
   * * must be alphanumeric, '.', '_', '-' characters
   * @param {string} val
   */
  static validateFaceCollectionId(val = '') {
    return /^[a-zA-Z0-9_.-]+$/.test(val);
  }

  /**
   * @static
   * @function validateImageBlob
   * @description image blob
   * * must begin with data:image/[png|jpeg|jpg];base64,<BASE64_String>
   * @param {string} val
   */
  static validateImageBlob(val = '') {
    return /^data:image\/(png|jpeg|jpg);base64,.{20,}/.test(val);
  }

  /**
   * @static
   * @function validateS3Uri
   * @description validate string is in a format of s3://<bucket>/<key>
   * @param {string} val
   */
  static validateS3Uri(val = '') {
    const url = new URL(val);
    const bucket = url.hostname;
    if (!bucket || !url.protocol || url.protocol.toLowerCase() !== 's3:') {
      return false;
    }
    return !(
      (bucket.length < 3 || bucket.length > 63)
      || /[^a-z0-9-.]/.test(bucket)
      || /^[^a-z0-9]/.test(bucket)
      || /\.{2,}/.test(bucket)
      || /^\d+.\d+.\d+.\d+$/.test(bucket)
    );
  }

  /**
   * @static
   * @function validateStateMachineArn
   * @description validate state machine execution arn
   * @param {string} val
   */
  static validateStateMachineArn(val = '') {
    return /^arn:aws:states:[a-z\d-]+:\d{12}:execution:[a-zA-Z\d-_]+:[a-fA-F\d]{8}(-[a-fA-F\d]{4}){3}-[a-fA-F\d]{12}$/.test(val);
  }

  /**
   * @static
   * @function validateSageMakerWorkteamName
   * @description validate sagemaker ground truth team name
   * * must be alphanumeric and '-'
   * * must not be more than 63 characters
   * @param {string} val
   */
  static validateSageMakerWorkteamName(val = '') {
    return /^[a-zA-Z0-9-]{3,63}$/.test(val);
  }

  /**
   * @static
   * @function validateEmailAddress
   * @description validate email address
   * @param {string} val
   */
  static validateEmailAddress(val = '') {
    return /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(val);
  }

  /**
   * @static
   * @function validateUsername
   * @description validate username
   * @param {string} val
   */
  static validateUsername(val = '') {
    return /^[a-zA-Z0-9._%+-]{1,128}$/.test(val);
  }

  /**
   * @static
   * @function validateGroupName
   * @description validate group name
   * @param {string} val
   */
  static validateGroupName(val = '') {
    return /^[a-zA-Z0-9_-]{0,128}$/.test(val);
  }

  /**
   * @static
   * @function validateAttributeKey
   * @description validate attribute key name
   * @param {string} val
   */
  static validateAttributeKey(val = '') {
    return /^[a-zA-Z0-9_-]{0,128}$/.test(val);
  }

  /**
   * @static
   * @function validateAttributeValue
   * @description validate attribute value
   * @param {string} val
   */
  static validateAttributeValue(val = '') {
    return /^[a-zA-Z0-9_%., -]{0,255}$/.test(val);
  }

  /**
   * @static
   * @function validateCharacterSet
   * @description validate character set (unicode and non-unicode)
   * @param {string} val
   */
  static validateCharacterSet(val = '', maxLen = 2048) {
    return (
      Buffer.from(val, 'utf8').byteLength <= maxLen &&
      ALL_CHARACTER_SETS.test(val)
    );
  }
}

module.exports = ValidationHelper;
