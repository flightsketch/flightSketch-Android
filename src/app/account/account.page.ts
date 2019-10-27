import { Component, OnInit } from '@angular/core';
import { NavController, NavParams } from '@ionic/angular';
import { HTTP } from '@ionic-native/http/ngx';
import { Storage } from '@ionic/storage';
import { LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {

    email: String;
    password: String;
    token: String;
    loggedIn: Boolean;
    userName: String;
    loginLoader: any;

    constructor(private loadingController: LoadingController, private http: HTTP, private storage: Storage) {
    }

    ngOnInit() {
        this.storage.get('FStoken').then((val) => {
            console.log('Token Found: ', val);
            this.token = "Token " + val;
            console.log(this.token);

            var url = "https://flightsketch.com/api/verify-token/";
            var headers = { Authorization: "falseToken" };//this.token };
            var params = {};
            this.http.get(url, params, headers).then((data) => {
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
        });
        
    }

    login(form) {

        console.log(this.email);
        var url = "https://flightsketch.com/api/api-token-auth/";
        var user = { username: this.email, password: this.password };
        var headers = {};

        this.loginLoader = this.loadingController.create({
            message: 'Logging In...'
        }).then((res) => {
            res.present();

            res.onDidDismiss().then((dis) => {
                console.log('Loading dismissed!');
            });
        });

        this.http.post(url, user, headers).then((data) => {
            console.log(JSON.parse(data.data).token);
            console.log(data.data);
            this.storage.set('FStoken', JSON.parse(data.data).token);
            this.loadingController.dismiss();
            alert("Success: Login Complete");

        }, (err) => {
                this.loadingController.dismiss();
                alert("Error: Login Failed");
        });

        
    }

}
