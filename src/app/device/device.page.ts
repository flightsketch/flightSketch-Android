import { Component, OnInit,ChangeDetectorRef} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { BLE } from '@ionic-native/ble/ngx';
import { AlertController } from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-device',
  templateUrl: './device.page.html',
  styleUrls: ['./device.page.scss'],
})
export class DevicePage implements OnInit {

  public deviceSub:Subscription = null;
  public connecting:Boolean = false;
  public device:any = {};
  public peripheral:any = {};
  public dataFileElements: Float32Array = new Float32Array(0);
  public dataFileElementsRead: number = 0;
  public dataFileLength: number = 0;

  constructor(private route: ActivatedRoute, private cdRef: ChangeDetectorRef, private alertController: AlertController, private ble: BLE, private router: Router) { 
    this.device = this.router.getCurrentNavigation().extras.state.device;
    console.log('device page construction');
    console.log(this.device);
  }

  ngOnInit() {

    console.log("device page init");
    
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

  connect() {
    this.connecting = true;
    this.ble.autoConnect(this.device.id, 
      (peripheral) => {

        this.peripheral = peripheral;
        this.device["connected"] = true;
        this.deviceSub = this.ble.startNotification(this.device.id, "6e400001-b5a3-f393-e0a9-e50e24dcca9e", "6e400003-b5a3-f393-e0a9-e50e24dcca9e")
                          .subscribe(data => this.parseData(data), () => this.notifyError());
      
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

    this.ble.write(this.device.id, "6e400001-b5a3-f393-e0a9-e50e24dcca9e", "6e400002-b5a3-f393-e0a9-e50e24dcca9e",data.buffer as ArrayBuffer);

  }

  downloadData() {
    console.log("download");
    this.dataFileElements = new Float32Array(0);
    this.dataFileLength = 0;
    this.dataFileElementsRead = 0;
    this.device["downloadProgress"] = "0%";
    this.device["filePackets"] = 0;
    let data = new Uint8Array(4);

    data[0] = 0xF5;
    data[1] = 0xF4;
    data[2] = 0x00;
    data[3] = 0xe9;

    this.ble.write(this.device.id, "6e400001-b5a3-f393-e0a9-e50e24dcca9e", "6e400002-b5a3-f393-e0a9-e50e24dcca9e",data.buffer as ArrayBuffer);

  }

  parseData(rawBuff) {
    this.connecting = false;
    let dataView = new DataView( rawBuff );    
    let packetType = dataView.getInt8(1);

    if (packetType != 1 && packetType != 6 ) {
      console.log("packetType="+packetType);
    }

   
    if ( packetType == 2 ) {
      // battery voltage
      console.log(this.bufferToHex(rawBuff));
      let battVoltage = dataView.getUint16(5)/1000.0;
      this.device["batteryVoltage"] = battVoltage.toFixed(1);

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
        this.dataFileElements = new Float32Array(fileLength);
        this.dataFileLength = fileLength;
      }
      console.log("fileLength = "+fileLength);

    } else if ( packetType == 4 ) {
      // 4 bytes of file contents

      let fileData:DataView = new DataView(rawBuff,4,4);
      this.dataFileElements[this.dataFileElementsRead] = fileData.getFloat32(0, true);
      this.dataFileElementsRead += 1;

      if ( this.dataFileElementsRead % 10 == 0 ) {
        let downloadProgress = this.dataFileElementsRead / this.dataFileLength * 100;
        this.device["downloadProgress"] = ""+ Math.round(downloadProgress) + "%"
      }
    
    } else if ( packetType == 5 ) {
      // download complete
      this.device["downloadProgress"] = "100%";

      if ( this.dataFileElementsRead > 16 ) {
        // have at least enough data for one row
        this.processDataFileAndSave();
      }
    
    } else if ( packetType == 6 ) {
      // armed and recording flag
      
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
      
    } else {

      console.log("unhandled packetType = "+packetType);

    }

    // read the rssi
    this.ble.readRSSI(this.device.id).then( rssi => {
      this.device["signal"] = rssi;
    });

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

    let lines:Array<String> = new Array<String>();
    lines.push("time, pressure, altitude, velocity\n");
    let numLines = this.dataFileElements.length / 4;

    for ( let i=0; i < numLines; i++) {
      let line = ""+this.dataFileElements[i*4].toFixed(3);
      line += ","+this.dataFileElements[i*4+1].toFixed(3);
      line += ","+this.dataFileElements[i*4+2].toFixed(3);
      line += ","+this.dataFileElements[i*4+3].toFixed(3);
      lines.push(line);
    }

    console.log("Read");
    console.log(lines);

    // writes lines to disk

  }
}
