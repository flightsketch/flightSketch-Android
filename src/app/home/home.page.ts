import { Component, OnInit } from '@angular/core';
import { BLE } from '@ionic-native/ble/ngx';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit  {

  constructor(private ble: BLE) { 
    console.log("home page constructed");
  }

  ngOnInit() {
    console.log("ngInit alled");
    this.ble.scan([], 5).subscribe(device => {
      console.log(JSON.stringify(device));
     
    });
  }  

}
