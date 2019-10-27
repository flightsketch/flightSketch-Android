import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { BLE } from '@ionic-native/ble/ngx';
import { File } from '@ionic-native/file/ngx';
import { HTTP } from '@ionic-native/http/ngx';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { GoogleMaps } from '@ionic-native/google-maps';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { DatePipe } from '@angular/common'
import { IonicStorageModule } from '@ionic/storage';

@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
      AppRoutingModule,
      IonicStorageModule.forRoot()
  ],
  providers: [
    StatusBar,
    BLE,
    File,
      HTTP,
    Geolocation,
    GoogleMaps,
    DatePipe,
    FileTransfer,
    SplashScreen,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
