// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

export default class GoogleMap {
  static async getSingleton(mapApiKey) {
    return new Promise((resolve) => {
      if (GoogleMap.singleton) {
        resolve(GoogleMap.singleton);
        return;
      }
      GoogleMap.loadMap(resolve, mapApiKey);
    });
  }

  static loadMap(resolve, apiKey = '') {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;

    script.onerror = (e) => {
      console.error(`GoogleMapLaoder onerror: ${encodeURIComponent(e.message)}`);
      resolve(undefined);
    };
    script.onload = () => {
      GoogleMap.singleton = new GoogleMap();
      resolve(GoogleMap.singleton);
    };
    window.document.body.appendChild(script);
  }

  static initMap() {
    GoogleMap.mapIsReady = true;
  }

  get mapIsReady() {
    return GoogleMap.mapIsReady;
  }

  static dms2dd(data) {
    const [
      deg,
      min,
      sec,
      dir,
    ] = data.split(' ').map(x => x.trim());

    let dd =
      Number.parseFloat(deg) + (Number.parseFloat(min) / 60) + (Number.parseFloat(sec) / 3600);
    if (dir === 'W' || dir === 'S') {
      dd = 0 - dd;
    }
    return dd;
  }

  render(dom, latitude, longitude) {
    const geo = {
      lat: GoogleMap.dms2dd(latitude),
      lng: GoogleMap.dms2dd(longitude),
    };

    const map = new google.maps.Map(dom, {
      zoom: 8,
      center: geo,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
    });

    const marker = new google.maps.Marker({
      position: geo,
      map,
    });
  }
}

GoogleMap.mapIsReady = false;
GoogleMap.singleton = undefined;
