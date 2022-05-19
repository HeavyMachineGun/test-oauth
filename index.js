require("dotenv").config();
const express = require('express'); //Import the express dependency
const axios = require('axios');
const crypto = require('crypto');
const session = require("cookie-session");
const app = express();              //Instantiate an express app, the main work horse of this server
const port = 8080;                  //Save the port number where your server will be listening
const path = require("path");
const { env } = require('process');
const router = express.Router();


app.use(express.static(__dirname + '/node_modules/bootstrap/dist'));
app.use(express.static(__dirname + '/node_modules/jquery/dist'));


app.use(session({
    // secret: "test session secret",
    // resave: false,
    // saveUninitialized: true,
    // cookie: { secure: true},
    name: "Cookie Session",
    maxAge: 24*60*60*1000,
    keys: ["secret key"]
}));

const client_secret = env.CLIENT_SECRET;

const GIT_HUB = {
    baseUrl: "http://localhost:8080/logedIn",
    client_id : env.CLIENT_ID,
    authorizeURL: env.AUTH_URL,
    tokenURL :env.TOKEN_URL,
    apiUrlBase: env.API_BASE
};
const auth_instance = axios.create(
    {
        baseUrl: "https://github.com/login/oauth"
    }
);


app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

//Idiomatic expression in express to route and respond to a client request
router.get('/', (req, res) => {        //get requests to the root ("/") will route here
    console.log(req.session.access_token);
    if(req.session.access_token!== undefined){
        return res.render("index",{ data: req, token: req.session.access_token}); 
    }else{
        return res.redirect("/login");
    }
});
function getHashCode(){
    const randomHash = crypto.randomBytes(20).toString('hex');
    return randomHash;
}
function toQueryString(object){
    return Object.keys(object)
                    .map(key => `${key}=${object[key]}`)
                    .join('&');

}
router.get('/login', (req, res) => {        //get requests to the root ("/") will route here
    req.session.auth_code ??= getHashCode();
    const code =  req.session.auth_code;
    let payload = {
        response_type: "code",
        client_id : GIT_HUB.client_id,
        redirect_uri: GIT_HUB.baseUrl,
        scope: "user public_repo",
        state: code
    }
    const qs = toQueryString(payload);
    
    res.redirect(GIT_HUB.authorizeURL +"?"+qs);
    
});
router.get('/logedIn', async (req, res) => {        //get requests to the root ("/") will route here
    let query = req.query;
    const code = req.session.auth_code;
    if(query.code !== undefined && req.session.access_token === undefined){
        if(query.state !== undefined && code=== query.state){
            
            let user_data = {
                grant_type :"authorization_code",
                client_id : GIT_HUB.client_id,
                client_secret : client_secret,
                redirect_uri : GIT_HUB.baseUrl,
                code : query.code
            };
            let response = await axios.post(GIT_HUB.tokenURL,user_data,{
                headers :{
                    'Accept': 'application/vnd.github.v3+json, application/json',
                    'User-Agent': 'http://localhost:8080/'
                }
            });
            req.session.access_token = response.data.access_token;
            return res.render("index",{ data: req, token: response.data.access_token, isLogedIn: true});
        }
    } 
    res.redirect("/");
});

router.get("/user/repository/all",async (req,res)=>{
    const authToken = req.session.access_token;
    const payload = {
        sort: "created",
        direction : "desc",
    };
    const qs = toQueryString(payload);
    var response = await axios.get(GIT_HUB.apiUrlBase+"user/repos?"+qs,{
        headers : {
            "Authorization": "Bearer "+authToken
        }
    });
    console.log(Object.keys(response));
    res.json(response.data);
});
app.use("/", router);
app.listen(port, () => {            //server starts listening for any attempts from a client to connect at port: {port}
    console.log(`Now listening on port ${port}`); 
});