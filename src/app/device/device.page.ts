import { Component, OnInit,ChangeDetectorRef} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { BLE } from '@ionic-native/ble/ngx';
import { AlertController } from '@ionic/angular';
import { Observable, Subscription, interval } from 'rxjs';
import { File } from '@ionic-native/file/ngx';
import { HTTP } from '@ionic-native/http/ngx';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import {
  GoogleMaps,
  GoogleMap,
  GoogleMapsEvent,
  LatLng,
  MarkerOptions,
  Marker
} from "@ionic-native/google-maps";
import { Platform, NavController } from "@ionic/angular";
import { DatePipe } from '@angular/common'
import { Storage } from '@ionic/storage';
import { LoadingController } from '@ionic/angular';
import { ViewChild, ElementRef } from "@angular/core";
import { Chart } from "chart.js";
import 'chartjs-plugin-zoom';
import 'hammerjs';

@Component({
  selector: 'app-device',
  templateUrl: './device.page.html',
  styleUrls: ['./device.page.scss'],
})
export class DevicePage implements OnInit {

    @ViewChild('map') element;
    @ViewChild("lineCanvas") lineCanvas: ElementRef;

  public deviceSub:Subscription = null;
  public connecting:Boolean = false;
  public mapInit:Boolean = false;
    public downloading: Boolean = false;
    public downloadComplete: Boolean = false;
  public device:any = {};
  public peripheral:any = {};
  public dataFileElements: Float32Array = new Float32Array(0);
  public dataFileElementsRead: number = 0;
    public dataFileLength: number = 0;
    public dataPacketLength: number = 0;
  public expectedLength: number = 0;
  public rxLength: number = 0;
  public localLat = 0;
  public localLon = 0;
  public remoteLat = 0;
  public remoteLon = 0;
  public map:GoogleMap;
  public marker: Marker;
  public remoteMarker: Marker;
    public localMarker: Marker;
    public lines: Array<String> = new Array<String>();
    public token: String = "";
    public loggedIn: Boolean = false;
    public userName: String = "";
    public uploadLoader: any;
    public fileNameInput: String = "";
    public titleInput: String = "";
    public descriptionInput: String = "";

    public avgWind: number = 0.0;
    public windDir: number = 0.0;
    public windGust: number = 0.0;
    public temp: number = 0.0;
    public humidity: number = 0.0;
    public cloudCover: number = 0.0;

    private lineChart: Chart;

    constructor(private loadingController: LoadingController,
                public googleMaps: GoogleMaps, public plt: Platform,
                public nav: NavController,private geolocation: Geolocation,
                private transfer: FileTransfer, private http: HTTP,
                private file: File, private route: ActivatedRoute,
                private cdRef: ChangeDetectorRef, private alertController: AlertController,
                private ble: BLE, private router: Router,
                public datepipe: DatePipe,
                private storage: Storage) {
    this.device = this.router.getCurrentNavigation().extras.state.device;
    console.log('device page construction');
    console.log(this.device);
    }

  ionViewDidEnter() {
    console.log("call ionViewDidLoad");
    this.plt.ready().then(() => {
      this.initMap();
    });
    let watch = this.geolocation.watchPosition({ enableHighAccuracy : true, timeout: 1000 });
        watch.subscribe((data) => {
        //console.log("Lat: " + data.coords.latitude);
        //console.log("Lon: " + data.coords.longitude);
        this.localLat = data.coords.latitude;
        this.localLon = data.coords.longitude;
        this.positionChange();
        let coordinates: LatLng = new LatLng(this.localLat, this.localLon);

      let position = {
        target: coordinates,
        zoom: 17
      };
      if (this.mapInit){
        this.map.animateCamera(position);
        console.log(position);
      }
    });

    interval(1000).subscribe(()=>{
        this.updateLocal();
    });

      Chart.defaults.global.maintainAspectRatio = false;
      
  }

  ngOnInit() {

    console.log("device page init");

    //this.http.setHeader('Authorization', 'Token f9e436075b1236f3a96f26808d22e543c37c8929');

    this.geolocation.getCurrentPosition().then((resp) => {
      console.log("Lat: " + resp.coords.latitude);
      console.log("Lon: " + resp.coords.longitude);
    }).catch((error) => {
      console.log('Error getting location', error);
    });



    //this.subscription = Observable.interval(1000).subscribe(x => {
    //    console.log ("called");
    //  });


    console.log(this.file.dataDirectory);




    //this.file.writeFile(this.file.externalApplicationStorageDirectory, 'test.csv', 'hello,world,', {replace: true})
    // .then(() => {
    //   console.log('success');

    // })
    // .catch((err) => {
    //   console.error(err);
    // });


    
    this.ble.isEnabled().then( 
      () => { 
        console.log('bluetooth is enabled')
        this.connect();

      }, 

      () => {
        // bluetooth is disabled
        this.alertController.create({
          header: 'Bluetooth Disabled',
          message: 'Bluetooth must be turned on for this to work.',
          buttons: ['OK']
        }).then( alert => {

          alert.present();

        });
      });
  }

  updateLocal(){

    this.geolocation.getCurrentPosition().then((resp) => {
      //console.log("Lat: " + resp.coords.latitude);
      //console.log("Lon: " + resp.coords.longitude);
      this.localLat = resp.coords.latitude;
      this.localLon = resp.coords.longitude;
    }).catch((error) => {
      console.log('Error getting location', error);
    });

  }

  initMap() {

    this.updateLocal();

    this.map = GoogleMaps.create(this.element.nativeElement);

    this.map.setMapTypeId("MAP_TYPE_SATELLITE");

    this.map.one(GoogleMapsEvent.MAP_READY).then((data: any) => {

      let coordinates: LatLng = new LatLng(this.localLat, this.localLon);

      let position = {
        target: coordinates,
        zoom: 17
      };

      this.map.animateCamera(position);

      this.map.setMyLocationEnabled(true);

      let markerOptions: MarkerOptions = {
        position: coordinates,
        title: 'Tracker Location'
      };

      this.remoteMarker = this.map.addMarkerSync(markerOptions);





    })
    this.mapInit = true;
  }

  positionChange(){
    //console.log("delta Lat: " + (this.localLat-this.remoteLat));
    //console.log("delta Lon: " + (this.localLon-this.remoteLon));
    let R = 3958.8; // miles
    let phi1 = this.localLat * 3.14159/180.0;
    let phi2 = this.remoteLat * 3.14159/180.0;
    let lam1 = this.localLon * 3.14159/180.0;
    let lam2 = this.remoteLon * 3.14159/180.0;
    let deltaPhi = (this.remoteLat-this.localLat) * 3.14159/180.0;
    let deltaLam = (this.remoteLon-this.localLon) * 3.14159/180.0;

    let a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLam/2) * Math.sin(deltaLam/2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    var d = R * c * 5280.0;
    console.log("Distance to target: " + d);

    let y = Math.sin(lam2-lam1) * Math.cos(phi2);
    let x = Math.cos(phi1)*Math.sin(phi2) -
        Math.sin(phi1)*Math.cos(phi2)*Math.cos(lam2-lam1);
    let brng = Math.atan2(y, x) * 180.0/3.14159;
    console.log("Bearing: " + brng);

    if (brng < 0){
        brng = brng + 360.0;
    }

    this.device["dist"] = d;
    this.device["bearing"] = Math.round(brng);


      this.remoteMarker.setPosition( { lat: this.remoteLat, lng: this.remoteLon });
        console.log("update");




  }



  connect() {
    this.connecting = true;
    this.ble.autoConnect(this.device.id, 
      (peripheral) => {

        this.peripheral = peripheral;
        this.device["connected"] = true;
        this.deviceSub = this.ble.startNotification(this.device.id, "6e400001-b5a3-f393-e0a9-e50e24dcca9e", "6e400003-b5a3-f393-e0a9-e50e24dcca9e")
                          .subscribe(data => this.parseData(data), () => this.notifyError());

        console.log(this.ble.requestMtu(this.device.id, 512));
      
      },(peripheral) => {

        this.device["connected"] = false;
        this.deviceSub.unsubscribe();
    
        this.alertController.create({
          header: 'Disconnected',
          message: 'The connection was broken, the app will auto-reconnect when possible',
          buttons: ['OK']
        }).then( alert => {
    
          alert.present();
    
        });
      });

  }


  notifyError() {
    this.connecting = false;
    console.log("notify error");

  }

  arm() {
      this.device["downloading"] = false;
      this.device["downloadComplete"] = false;
    let data = new Uint8Array(4);
    data[0] = 0xF5;
    data[1] = 0xF1;
    data[2] = 0x00;
    data[3] = 0xe6;

    this.ble.write(this.device.id, "6e400001-b5a3-f393-e0a9-e50e24dcca9e", "6e400002-b5a3-f393-e0a9-e50e24dcca9e",data.buffer as ArrayBuffer);

  }

  startRecording() {
    console.log("start recofding");
    let data = new Uint8Array(4);
    data[0] = 0xF5;
    data[1] = 0xF2;
    data[2] = 0x00;
    data[3] = 0xe7;

    this.ble.write(this.device.id, "6E400001-B5A3-F393-E0A9-E50E24DCCA9E", "6E400002-B5A3-F393-E0A9-A50E24DCCA9E",data.buffer as ArrayBuffer);

  }

  downloadData() {
    console.log("download");
    this.dataFileElements = new Float32Array(0);
    this.dataFileLength = 0;
    this.dataFileElementsRead = 0;
    this.device["downloadProgress"] = "0%";
    this.device["filePackets"] = 999;
    this.device["downloading"] = true;
    let data = new Uint8Array(4);

    this.downloading = true;

    data[0] = 0xF5;
    data[1] = 0xF4;
    data[2] = 0x00;
    data[3] = 0xe9;

    this.ble.write(this.device.id, "6e400001-b5a3-f393-e0a9-e50e24dcca9e", "6e400002-b5a3-f393-e0a9-e50e24dcca9e",data.buffer as ArrayBuffer);

    this.cdRef.detectChanges();

  }

  parseData(rawBuff) {
    this.connecting = false;

    //console.log("packet rx");

    let dataView = new DataView( rawBuff );    
    let packetType = dataView.getInt8(1);
    //console.log("packetType="+packetType);

    if (packetType != 1 && packetType != 6 ) {
       //console.log("packetType="+packetType);
    }

   
    if ( packetType == 2 ) {
      // battery voltage
      //console.log(this.bufferToHex(rawBuff));
      let battVoltage = dataView.getUint16(5)/1000.0;
      this.device["batteryVoltage"] = battVoltage.toFixed(2);

    } else if ( packetType == 1 ) {

      // 4 byte temp, 4 byte altitude, 4 byte maxAltitude
      
      let tempView:DataView = new DataView(rawBuff,4,4);
      let temp = tempView.getFloat32(0, true) * (9.0/5.0)+32.0;
      this.device["temp"] = temp.toFixed(1);

      let altView:DataView = new DataView(rawBuff,8,4);
      let alt = altView.getFloat32(0, true);
      this.device["altitude"] = Math.round(alt);

      let maxaltView:DataView = new DataView(rawBuff,12,4);
      let malt = maxaltView.getFloat32(0, true);
      this.device["maxAltitude"] = Math.round(malt);

    } else if ( packetType == 3 ) {
      // file length reporting

      let flView:DataView = new DataView(rawBuff,4,4);
      let fileLength = flView.getUint32(0, true);

      if ( fileLength > 0 ) {
        this.dataFileElements = new Float32Array(fileLength/4);
        this.dataFileLength = fileLength;
      }
      console.log("fileLength = "+fileLength);

      this.expectedLength = fileLength;
      this.rxLength = 0;

    } else if ( packetType == 4 ) {
      // 4 bytes of file contents

      console.log(rawBuff);

      let fileData:DataView = new DataView(rawBuff,4,4);
      this.dataFileElements[this.dataFileElementsRead] = fileData.getFloat32(0, true);
      this.dataFileElementsRead += 1;
      //console.log(fileData.getFloat32(0, true));

      if ( this.dataFileElementsRead % 100 == 0 ) {
        //let downloadProgress = this.dataFileElementsRead*4 / this.dataFileLength * 100;
        //this.device["downloadProgress"] = ""+ Math.round(downloadProgress) + "%"
        //console.log(downloadProgress);
      }
    
    } else if ( packetType == 5 ) {
      // download complete
      console.log("download complete");

      

      if ( this.dataFileElementsRead > 16 ) {
        // have at least enough data for one row
        //this.processDataFileAndSave();
      }

      
    
    } else if ( packetType == 6 ) {
      // armed and recording flag

        this.device["dataAvailable"] = false;
      
      let recordingAndArmedView:DataView = new DataView(rawBuff, 4, 2);
      let recording = recordingAndArmedView.getUint8(0);
      if ( recording > 0 ) {
        console.log("Dev reporting recording");
        this.device["recording"] = true;
      } else {
        this.device["recording"] = false;
      }

      let armed = recordingAndArmedView.getUint8(1);
      if ( armed > 0 ) {
        this.device["armed"] = true;
      } else {
        this.device["armed"] = false;
      }

    } else if ( packetType == 7 ) {

      //console.log(rawBuff);
        this.device["dataAvailable"] = true;

        let dataLength = dataView.getInt8(2) - 2;
        if (this.dataPacketLength == 0) {
            this.dataPacketLength = dataLength;
        }
      let packetID = dataView.getUint16(4, true);
      //console.log(packetID);
      //console.log(dataLength);

      for ( let i=0; i < dataLength; i++) {
          //console.log(i);
          let fileData: DataView = new DataView(rawBuff, 6 + 4 * i, 4);
          this.dataFileElements[this.dataPacketLength*packetID + i] = fileData.getFloat32(0, true);
          this.dataFileElementsRead += 1;
          //console.log(fileData.getFloat32(0, true));

          if ( this.dataFileElementsRead % 100 == 0 ) {
            let downloadProgress = this.dataFileElementsRead*4 / this.dataFileLength * 100;
            this.device["downloadProgress"] = ""+ Math.round(downloadProgress) + "%"
            //console.log(downloadProgress);
          }
      }


      this.rxLength = this.rxLength + dataLength*4;
      //console.log(this.rxLength);

        if ((this.rxLength >= this.expectedLength) && (this.expectedLength > 16)) {
            this.dataPacketLength = 0;
            this.expectedLength = 0;
            this.device["downloadProgress"] = "100%";
            this.device["downloading"] = false;
            this.device["downloadComplete"] = true;
            this.processDataFileAndSave();
      }

    } else if ( packetType == 8 ) {

      // GPS packet

      //console.log(this.bufferToHex(rawBuff));

      let gpsIDView:DataView = new DataView(rawBuff,4,2);
      let gpsID = gpsIDView.getUint16(0, true);
      this.device["gpsID"] = gpsID;

      let gpsFixView:DataView = new DataView(rawBuff,6,1);
      let gpsFix = gpsFixView.getUint8(0);
      this.device["gpsFix"] = gpsFix;

      let gpsSatsView:DataView = new DataView(rawBuff,7,1);
      let gpsSats = gpsSatsView.getUint8(0);
      this.device["gpsSats"] = gpsSats;

      let gpsTimeView:DataView = new DataView(rawBuff,8,4);
      let gpsTime = gpsTimeView.getUint32(0, true);
      this.device["gpsTime"] = gpsTime;

      let gpsBattView:DataView = new DataView(rawBuff,12,2);
      let gpsBatt = gpsBattView.getUint16(0, true);
      this.device["gpsBatt"] = gpsBatt;

      let gpsLatView:DataView = new DataView(rawBuff,16,4);
      let gpsLat = gpsLatView.getInt32(0, true);
      this.device["gpsLat"] = gpsLat*0.0000001;

      let gpsLonView:DataView = new DataView(rawBuff,20,4);
      let gpsLon = gpsLonView.getInt32(0, true);
      this.device["gpsLon"] = gpsLon*0.0000001;

      let gpsAltView:DataView = new DataView(rawBuff,24,4);
      let gpsAlt = gpsAltView.getInt32(0, true);
      this.device["gpsAlt"] = Math.round(gpsAlt*0.001*(39.37/12));

      let gpsGndSpdView:DataView = new DataView(rawBuff,28,2);
      let gpsGndSpd = gpsGndSpdView.getInt16(0, true);
      this.device["gpsGndSpd"] = Math.round(gpsGndSpd*0.1);

      let gpsVertSpdView:DataView = new DataView(rawBuff,30,2);
      let gpsVertSpd = gpsVertSpdView.getInt16(0, true);
      this.device["gpsVertSpd"] = Math.round(gpsVertSpd*0.1);

      let gpsHeadingView:DataView = new DataView(rawBuff,32,2);
      let gpsHeading = gpsHeadingView.getInt16(0, true) * 0.1;
      if (gpsHeading < 0){
        gpsHeading = gpsHeading + 360.0;
      }
      this.device["gpsHeading"] = Math.round(gpsHeading);

      this.remoteLat = gpsLat * 0.0000001;
      this.remoteLon = gpsLon * 0.0000001;

      this.positionChange();

      console.log("remote lat: " + this.remoteLat);
      console.log("remote lon: " + this.remoteLon);


    } else {

      console.log("unhandled packetType = "+packetType);

    }

    // read the rssi
    this.ble.readRSSI(this.device.id).then( rssi => {
      this.device["signal"] = rssi;
    });

    this.cdRef.detectChanges();
    

  }

  onNotificationFail() {
    console.log("error on notification");
  }

  bufferToHex (buffer) {

    return Array
        .from (new Uint8Array (buffer))
        .map (b => b.toString(16).padStart (2, "0"))
        .join (" ");
  }  

  ionViewWillLeave() {
    console.log("leaving the page, disconnecting");
    this.ble.disconnect(this.device.id);
  }

    processDataFileAndSave() {

      this.downloadComplete = true;
      this.lines = new Array<String>();
    this.lines.push("time,pressure,altitude,velocity\n");
      let numLines = this.dataFileElements.length / 4;

    let time:Array<number> = new Array<number>();
    let pressure:Array<number> = new Array<number>();
    let altitude:Array<number> = new Array<number>();
    let velocity:Array<number> = new Array<number>();
    let accel:Array<number> = new Array<number>();

    let rawAlt:Array<number> = new Array<number>();

    let x:Array<number> = new Array<number>();
    let y:Array<number> = new Array<number>();
    let x2:Array<number> = new Array<number>();
    let x3:Array<number> = new Array<number>();
    let x4:Array<number> = new Array<number>();
    let yx:Array<number> = new Array<number>();
    let yx2:Array<number> = new Array<number>();

    let sumX:number = 0;
    let sumY:number = 0;
    let sumX2:number = 0;
    let sumX3:number = 0;
    let sumX4:number = 0;
    let sumYX:number = 0;
    let sumYX2:number = 0;

    let factor:number = 0;
    let C1:number = 0;
    let C2:number = 0;

    let instVel1:number = 0;
    let instVel2:number = 0;
    let instAcc:number = 0;

    let dt:number = 0.020;
    let addPoint:Boolean = false;

    let tStart:number = 0;
    let tStop:number = 0;
    let indexStart = 0;
    let indexStop = 0;
    let dim = 11;
    let n = 21;
      let burnout: Boolean = false;
      let launchDetect: Boolean = false;

      let maxVelocity: number = 0;
      let maxAlt: number = 0;
      let avgDescent: number = 0;
      let timeToBurnout: number = 0;
      let timeToApogee: number = 0;
      let totalTime: number = 0;
        let timeOffset: number = 0;

        let date = new Date();
        let fileName: string = "";
        let latest_date = this.datepipe.transform(date, 'yyyy-MM-dd__HH-mm-ss');
        console.log(latest_date);
        fileName = "fltSk_" + latest_date;
        this.fileNameInput = fileName;



    for ( let i=0; i < numLines; i++) {

      time.push(this.dataFileElements[i*4]);
      pressure.push(this.dataFileElements[i*4+1]);
      altitude.push(this.dataFileElements[i*4+2]);
      velocity.push(this.dataFileElements[i*4+3]);

      rawAlt.push(pressure[i]/101.325);
      rawAlt[i] = Math.pow(rawAlt[i],0.190284);
      rawAlt[i] = 1.0 - rawAlt[i];
      rawAlt[i] = rawAlt[i] * 145366.45;


      // Filter out possible ejection spikes before curve fitting for velocity
      addPoint = false;
      if (i>1){
        instVel1 = (rawAlt[i-1] - rawAlt[i-2]) / dt;
        instVel2 = (rawAlt[i] - rawAlt[i-1]) / dt;
        instAcc = (instVel2 - instVel1) / dt;
        instAcc = instAcc/32.2;
        if (Math.abs(instAcc) < 10000){
          addPoint = true;
        } else {
          console.log("Spike at: " + time[i]);
        }
      } else {
        addPoint = true;
      }

      if (addPoint){
        x.push(time[i]);
        y.push(rawAlt[i]);
        x2.push(Math.pow(time[i],2.0));
        x3.push(Math.pow(time[i],3.0));
        x4.push(Math.pow(time[i],4.0));
        yx.push(time[i]*rawAlt[i]);
        yx2.push(Math.pow(time[i],2.0)*rawAlt[i]);
      }

      //let line = ""+this.dataFileElements[i*4].toFixed(3);
      //line += ","+this.dataFileElements[i*4+1].toFixed(3);
      //line += ","+this.dataFileElements[i*4+2].toFixed(3);
      //line += ","+this.dataFileElements[i*4+3].toFixed(3);
      //line += "\n";
      //lines.push(line);
      //console.log(line);
    }

    console.log(x);
    console.log(y);

    for (let i=0; i < numLines; i++) {
      if (i<11 || i>numLines-51){
        velocity[i] = 0;
      } else {
        tStart = time[i-dim];
        tStop = time[i+dim];
        indexStart = 0;
        indexStop = x.length-1;
        while (x[indexStart] < tStart){
          indexStart = indexStart + 1;
        }
        while (x[indexStop] > tStop){
          indexStop = indexStop - 1;
        }
        n = indexStop - indexStart + 1;

        //console.log("i:" + i + " tstart: " + tStart + " tStop:" + tStop + " indexStart:" + indexStart + " indexStop:" + indexStop + " n: " + n);

        sumX = 0;
        sumY = 0;
        sumX2 = 0;
        sumX3 = 0;
        sumX4 = 0;
        sumYX = 0;
        sumYX2 = 0;

        for (let j=indexStart; j<indexStop+1; j++){

        sumX = sumX + x[j];
        sumY = sumY + y[j];
        sumX2 = sumX2 + x2[j];
        sumX3 = sumX3 + x3[j];
        sumX4 = sumX4 + x4[j];
        sumYX = sumYX + yx[j];
        sumYX2 = sumYX2 + yx2[j];
        }


        factor = 1/(-Math.pow(sumX2,3.0)+sumX4*n*sumX2+2.0*sumX3*sumX*sumX2-sumX4*Math.pow(sumX,2.0)-Math.pow(sumX3,2.0)*n);
        C1 = factor*(sumYX*(sumX2*sumX-sumX3*n)+sumY*(sumX3*sumX-Math.pow(sumX2,2.0))+sumYX2*(sumX2*n-Math.pow(sumX,2.0)));
        C2 = factor*(sumYX*(sumX4*n-Math.pow(sumX2,2.0))+sumY*(sumX2*sumX3-sumX4*sumX)+sumYX2*(sumX2*sumX-sumX3*n));

        velocity[i] = 2*C1*time[i] + C2;
          accel[i] = 2 * C1;

          this.device["totalTime"] = time[i] - timeOffset;

          if (!launchDetect && velocity[i] > 30.0) {
              launchDetect = true;
              timeOffset = time[i]-0.2
          }

          if (velocity[i] > maxVelocity) {
              this.device["maxVelocity"] = velocity[i];
              this.device["timeToBurnout"] = time[i] - timeOffset;
              maxVelocity = velocity[i];
              //console.log(this.device["maxVelocity"]);
          }

          if (altitude[i] > maxAlt) {
              maxAlt = altitude[i];
              this.device["maxAlt"] = altitude[i];
              this.device["timeToApogee"] = time[i] - timeOffset;
          }

          if (!burnout && launchDetect && (accel[i] < -32.2) && (accel[i - 10] < -32.2)) {
              burnout = true
          }

          if (burnout && dim < 50) {
              dim = dim + 1;
              n = n + 2;
          }

          this.device["avgDescent"] = maxAlt/(this.device["totalTime"] - this.device["timeToApogee"]);
      }
    }

      for (let i = 0; i < numLines; i++) {
          let line = "" + (time[i] - timeOffset).toFixed(3);
          line += "," + pressure[i].toFixed(4);
          line += "," + altitude[i].toFixed(3);
          line += "," + velocity[i].toFixed(3);
          line += "\n";
          this.lines.push(line);
      }

        this.cdRef.detectChanges();

        let altitudePlot: Array<{ x: number, y: number }> = new Array<{ x: number, y: number }>();
        let velocityPlot: Array<{ x: number, y: number }> = new Array<{ x: number, y: number }>();

        for (let i = 0; i < numLines; i++) {

            altitudePlot[i] = {
                x: time[i] - timeOffset,
                y: altitude[i]
            };

            velocityPlot[i] = {
                x: time[i] - timeOffset,
                y: velocity[i]
            };

        }

        this.lineChart = new Chart(this.lineCanvas.nativeElement, {
            type: "scatter",
            label: "Flight Data",
            data: {
                datasets: [
                    {
                        showLine: true,
                        label: 'Altitude',
                        yAxisID: 'Alt',
                        fill: false,
                        pointRadius: 0,
                        backgroundColor: 'rgba(0, 0, 255, 1)',
                        borderColor: 'rgba(0, 0, 255, 1)',
                        data: altitudePlot,
                        
                    },
                    {
                        showLine: true,
                        label: 'Vertical Velocity',
                        yAxisID: 'Alt',
                        fill: false,
                        pointRadius: 0,
                        backgroundColor: 'rgba(255, 0, 0, 1)',
                        borderColor: 'rgba(255, 0, 0, 1)',
                        data: velocityPlot,

                    },
                    
                ]
            },
            options: {
                title: {
                    display: true,
                    text: 'Flight Data',
                    fontSize: 18,
                },
                responsive: true,
                pan: {
                    enabled: true,
                    mode: 'xy',
                },
                zoom: {
                    enabled: true,
                    drag: false,
                    mode: 'xy',
                },
                tooltips: {
                    mode: 'label',
                    callbacks: {
                        label: function (tooltipItem, data) {
                            return Math.round(tooltipItem.yLabel);
                        },
                        title: function (tooltipItem, data) {
                            return "Time: " + 0.01*Math.round(tooltipItem[0].xLabel*100) + "s";
                        },
                    }
                },
                scales: {
                    xAxes: [{
                        ticks: {
                            maxTicksLimit: 11,
                            //precision: 0,
                            //stepsize: 5
                            // Include a dollar sign in the ticks
                            callback: function (value, index, values) {
                                return Math.round(value);
                            }
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Flight Time (s)'
                        }
                    }],
                    yAxes: [{
                        id: 'Alt',
                        labelString: 'Altitude (ft)',
                        type: 'linear',
                        position: 'left',
                        scaleLabel: {
                            display: true,
                            labelString: 'Alt (ft) / Vert. Vel. (ft/s)'
                        }
                    }]
                }
            },
            plugins: {
                
            }, 
            

        });

       
      

    //console.log("Read");
    //console.log(lines);

    this.downloading = false;
        this.cdRef.detectChanges();

        var url = "https://flightsketch.com/weather/";
        var headers = {  };
        var params = {lat: this.localLat.toFixed(7), lon: this.localLon.toFixed(7)};

        this.http.get(url, params, headers).then((data) => {
            console.log(data);
            this.avgWind = JSON.parse(data.data).avg_wind;
            this.windDir = JSON.parse(data.data).wind_dir;
            this.windGust = JSON.parse(data.data).wind_gust;
            this.temp = JSON.parse(data.data).temp;
            this.humidity = JSON.parse(data.data).humidity;
            this.cloudCover = JSON.parse(data.data).cloud_cover;
        }, (err) => {
                console.log(err);
        });

    // writes lines to disk

  }

    async uploadData() {
        var buf = new ArrayBuffer(this.lines.length * 2 * 30); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        var count = 0;
        var data = "";
        let numLines = this.dataFileElements.length / 4;
        let fileName: string = "";
        let storagePath = "";
        fileName = this.fileNameInput + ".csv";

        if (this.plt.is("ios")) {
            storagePath = this.file.syncedDataDirectory;
        } else if (this.plt.is("android")) {
            storagePath = this.file.externalApplicationStorageDirectory;
        }

        await this.uploadLoader;

        this.uploadLoader = this.loadingController.create({
            message: 'Uploading Data...'
        }).then((res) => {
            res.present();

            res.onDidDismiss().then((dis) => {
                console.log('Loading dismissed!');
            });
        });

        await this.storage.get('FStoken').then((val) => {
            console.log('Token Found: ', val);
            this.token = "Token " + val;
            console.log(this.token); 
        });

        var url = "https://flightsketch.com/api/verify-token/";
        var headers = { Authorization: this.token };
        var params = {};

        await this.http.get(url, params, headers).then((data) => {
            console.log(JSON.parse(data.data).name);
            if (JSON.parse(data.data).name == "") {
                console.log("no name");
                this.loggedIn = false;
            } else {
                this.loggedIn = true;
                this.userName = JSON.parse(data.data).name;

            }
        }, (err) => {

        });

        if (this.loggedIn) {

            for (var line = 0; line < numLines; line++) {
                data = data + this.lines[line];
                for (var i = 0, strLen = this.lines[line].length; i < strLen; i++) {
                    bufView[count] = this.lines[line].charCodeAt(i);
                    count++;
                }
            }

            this.file.writeFile(storagePath, fileName, data, { replace: true })
                .then(() => {
                    console.log('success');
                    let filePathVar = storagePath + '/' + fileName;
                    const fileTransfer: FileTransferObject = this.transfer.create();

                    let options1: FileUploadOptions = {
                        fileKey: 'logFile',
                        fileName: fileName,
                        chunkedMode: false,
                        mimeType: "application/csv",
                        params: {
                            title: this.titleInput,
                            description: this.descriptionInput,
                            apogee: this.device["maxAlt"].toFixed(1),
                            max_vertical_velocity: this.device["maxVelocity"].toFixed(1),
                            avg_descent_rate: this.device["avgDescent"].toFixed(1),
                            time_to_burnout: this.device["timeToBurnout"].toFixed(2),
                            time_to_apogee: this.device["timeToApogee"].toFixed(2),
                            time_to_landing: this.device["totalTime"].toFixed(2),
                            avg_wind: this.avgWind.toFixed(1),
                            wind_gust: this.windGust.toFixed(1),
                            wind_dir: this.windDir.toFixed(0),
                            temp: this.temp.toFixed(1),
                            humidity: this.humidity.toFixed(0),
                            cloud_cover: this.cloudCover.toFixed(0),

                        },
                        headers: { Authorization: this.token }

                    }
                    // Works
                    fileTransfer.upload(filePathVar, 'https://flightsketch.com/api/rocketflights/', options1)
                        .then((data) => {
                            // success
                            this.loadingController.dismiss();
                            alert("File Upload Complete");
                            this.file.removeFile(this.file.externalApplicationStorageDirectory, fileName);
                        }, (err) => {
                                // error
                                this.loadingController.dismiss();
                            alert("Upload error:   " + JSON.stringify(err));
                        });

                })
                .catch((err) => {
                    console.error(err);
                });
        } else {
            alert("Please log in to upload data.");
        }
    }


    saveLocal() {
        var buf = new ArrayBuffer(this.lines.length * 2 * 30); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        var count = 0;
        var data = "";
        let numLines = this.dataFileElements.length / 4;
        let fileName: string = "";
        let storagePath = "";

        if (this.plt.is("ios")) {
            storagePath = this.file.documentsDirectory;
        } else if (this.plt.is("android")) {
            storagePath = this.file.externalApplicationStorageDirectory;
        }
        fileName = this.fileNameInput + ".csv";

        for (var line = 0; line < numLines; line++) {
            data = data + this.lines[line];
            for (var i = 0, strLen = this.lines[line].length; i < strLen; i++) {
                bufView[count] = this.lines[line].charCodeAt(i);
                count++;
            }
        }

        console.log(this.fileNameInput);

        this.file.writeFile(storagePath, fileName, data, { replace: true })
            .then(() => {
                console.log('success');
                alert("File Save Complete");
            })
            .catch((err) => {
                console.error(err);
            });
    }








}
