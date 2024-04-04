// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

class MergeHelper {
  /**
   * @static
   * @function isObject
   * @description test if obj is object type
   * @param {object} obj
   * @returns {boolean}
   */
  static isObject(obj) {
    return obj != null && typeof obj === 'object';
  }

  /**
   * @static
   * @function isPrimitive
   * @description test if object is primitive type
   * note: the logic also consider 'null' is primitive!
   * @param {object} obj
   * @returns {boolean}
   */
  static isPrimitive(obj) {
    switch (typeof obj) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
      case 'symbol':
        return true;
      default:
        break;
    }
    return (obj === null);
  }

  /**
   * @static
   * @function internalMerge
   * @description merge two objects recursively
   * @param {object} target
   * @param {object} source
   * @returns {object} merged object
   */
  static internalMerge(target, source) {
    if (!MergeHelper.isObject(target) || !MergeHelper.isObject(source)) {
      return source;
    }

    Object.keys(source).forEach(key => {
      const targetValue = target[key];
      const sourceValue = source[key];
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        target[key] = Array.from(new Set(targetValue.concat(sourceValue)))
          .filter(x => x !== undefined);
      } else if (MergeHelper.isObject(targetValue) && MergeHelper.isObject(sourceValue)) {
        target[key] = MergeHelper.internalMerge({
          ...targetValue,
        }, sourceValue);
      } else {
        target[key] = sourceValue;
      }
    });
    return target;
  }

  /**
   * @static
   * @function internalCleansing
   * @description remove empty key recursively
   * @param {object} obj
   * @param {object} [removeList]
   * @param {boolean} [removeList.array] - should remove empty array
   * @param {boolean} [removeList.object] - should remove empty object
   * @returns {object} clean object
   */
  static internalCleansing(obj, removeList = {}) {
    if (MergeHelper.isPrimitive(obj)) {
      return ((obj === null) || (typeof obj === 'string' && !obj.length))
        ? undefined
        : obj;
    }

    if ((removeList.array || removeList.object) && !Object.keys(obj).length) {
      return undefined;
    }

    const duped = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach((x) => {
      duped[x] = MergeHelper.internalCleansing(obj[x], removeList);
    });

    return Array.isArray(duped)
      ? duped.filter(x => x !== undefined)
      : duped;
  }

  static flatten(arr, depth = 1) {
    return (depth > 0)
      ? arr.reduce((acc, cur) =>
        acc.concat(Array.isArray(cur)
          ? MergeHelper.flatten(cur, depth - 1)
          : cur), [])
      : arr.slice();
  }
}

module.exports = MergeHelper;
