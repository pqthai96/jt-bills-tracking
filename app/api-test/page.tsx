"use client"

import React, {useEffect, useState} from 'react';
import axios from "axios";

function Page() {
    const [authToken, setAuthToken] = useState<any>("");

    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');
        setAuthToken(ylToken);
        axios.post(
            "https://jmsgw.jtexpress.vn/systemapi/userBehavior/batchCollect",
            {
                "jmsUserBehaviors": [
                    {
                        "networkCode": "028M08",
                    }
                ],
                "countryId": "1"
            },
            { headers: { authToken: "5c621cb33e88440e9e891e528e7fdb2b", lang: 'VN', langType: 'VN' } }
        );
    }, [authToken]);

    return (
        <div></div>
    );
}

export default Page;