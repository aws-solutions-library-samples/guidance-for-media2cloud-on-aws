const EXPIRE_IN_7DAYS = 7 * 24 * 60 * 60 * 1000;

const StoreDefinitions = {
  Stores: {
    Images: 'local-images',
    Settings: 'settings',
    Dataset: 'dataset',
  },
  TimeToLive: {
    Name: 'ttl',
    Value: EXPIRE_IN_7DAYS,
  },
};
export default StoreDefinitions;
