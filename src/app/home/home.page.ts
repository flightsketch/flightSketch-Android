import { Component, OnInit,ChangeDetectorRef } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { BLE } from '@ionic-native/ble/ngx';
import { Platform, AlertController } from '@ionic/angular';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit  {

  public devices = [];
  public scanning = false;
  public connectedDeviceSub = null;

  constructor(private plt: Platform, private cdRef: ChangeDetectorRef, private alertController: AlertController, private ble: BLE, private router: Router) { 
    this.devices = [];
  }

  ngOnInit() {
    //this.doRefresh(false);
  }

  ionViewDidEnter() {
      console.log("call ionViewDidLoad");
      this.plt.ready().then(() => {
            this.doRefresh(false);
        });
  }

  openDevicePage(dev) {

    let navigationExtras: NavigationExtras = {
      state: {
        device: dev
      }
    };
    this.router.navigate(['device'], navigationExtras);

  }

  doRefresh(event) {

    this.ble.isEnabled().then( 
      () => { 
        this.scanning = true;
        let subscription = this.ble.startScan([]).subscribe(device => { 
          if ( device.name && device.name.startsWith("FlightSketch") ) {          
            if ( !this.devices.some(d => { return d.name == device.name }) ) {             
              this.devices.push(device);
            }
          }
        });
    
        setTimeout(() => {
          this.scanning = false;
          this.ble.stopScan();
          subscription.unsubscribe();
          if ( event ) {
            event.target.complete();
          }
        }, 3000);
      }, 

      () => {
        // bluetooth is disabled
        this.alertController.create({
          header: 'Bluetooth Disabled',
          message: 'Bluetooth must be turned on for this to work.',
          buttons: ['OK']
        }).then( alert => {

          if ( event ) {
            event.target.complete();
          }
          alert.present();

        });
      });    

    console.log("scanning");

  }    


}
