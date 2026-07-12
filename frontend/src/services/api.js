import axios from "axios";

const api = axios.create({

    baseURL: "http://54.206.224.166:3000"

});

api.interceptors.request.use((config)=>{

    const token = localStorage.getItem("MII_AUTH_TOKEN");

    if(token){

        config.headers.Authorization =
            `Bearer ${token}`;

    }

    return config;

});

api.interceptors.response.use(

    response=>response,

    error=>{

        if(error.response?.status===401){

            localStorage.removeItem("MII_AUTH_TOKEN");

            localStorage.removeItem("MII_AUTH_USER");

            window.location="/";

        }

        return Promise.reject(error);

    }

);

export default api;
