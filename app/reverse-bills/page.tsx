"use client";

import React, {useEffect, useState} from 'react';
import BillsTrackingSection from "@/components/bills-tracking/bills-tracking-section";
import axios from "axios";
import {useRouter} from 'next/navigation';
import {NETWORK_CODE_STORAGE_KEY} from "@/lib/networkCode";

function Page() {

    const router = useRouter();
    const [authToken, setAuthToken] = useState<string>("");
    const [networkCode, setNetworkCode] = useState<any>({code: "028M08", label: "028M08", agentCode: "028001"});
    const [reverseNum, setReverseNum] = useState(0);
    const [bills, setBills] = useState<any>([]);

    // Tạo startTime và endTime cho ngày hiện tại
    const getCurrentDateRange = () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');

        const startTime = `${year}-${month}-${day} 00:00:00`;
        const endTime = `${year}-${month}-${day} 23:59:59`;

        return {startTime, endTime};
    };
    console.log(authToken)

    // Kiểm tra token trước khi vào trang
    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');
        const savedNetworkCode = localStorage.getItem(NETWORK_CODE_STORAGE_KEY);

        if (!ylToken || ylToken === "" || ylToken === null) {
            router.push('/');
            return;
        }
        setAuthToken(ylToken);
        if (savedNetworkCode) setNetworkCode(savedNetworkCode);
    }, [router]);

    useEffect(() => {
        if (!authToken) return;

        const {startTime, endTime} = getCurrentDateRange();

        axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_total", {
                "current": 1,
                "size": 20,
                "Dimensions": "Network",
                "scanNetworkCode": networkCode.code,
                "countryId": "1",
                "startTime": startTime,
                "startDate": startTime,
                "endTime": endTime,
                "endDate": endTime
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            });

        axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_sum", {
                "current": 1,
                "size": 20,
                "Dimensions": "Network",
                "scanNetworkCode": networkCode.code,
                "countryId": "1",
                "startTime": startTime,
                "startDate": startTime,
                "endTime": endTime,
                "endDate": endTime
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }).then((resp: any) => setReverseNum(resp.data.data.records[0].reserveNum));
    }, [authToken])

    useEffect(() => {
        if (!authToken) return;

        const {startTime, endTime} = getCurrentDateRange();

        axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_ret_detail", {
                "current": 1,
                "size": reverseNum,
                "startDate": startTime,
                "endDate": endTime,
                "scanAgentCode": networkCode.agentCode,
                "scanNetworkCode": networkCode.code,
                "countryId": "1",
                "isFlag": "1"
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }).then((resp: any) => setBills(resp.data.data.records.map((record: any) => record.billcode)));
    }, [reverseNum]);

    return (
        <div>
            <BillsTrackingSection bills={bills} authToken={authToken} isBillTracking={false}/>
        </div>
    );
}

export default Page;