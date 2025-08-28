"use client";

import React, {useEffect, useState} from 'react';
import { useRouter } from 'next/navigation';
import BillsTrackingSection from "@/components/bills-tracking/bills-tracking-section";
import axios from "axios";

function Page() {
    const router = useRouter();
    const [authToken, setAuthToken] = useState<string>("");
    const [arrivalMissNum, setArrivalMissNum] = useState(0);
    const [bills, setBills] = useState<any>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Tạo startTime và endTime cho ngày hiện tại
    const getCurrentDateRange = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const startTime = `${year}-${month}-${day} 00:00:00`;
        const endTime = `${year}-${month}-${day} 23:59:59`;
        // const startTime = `2025-08-27 00:00:00`;
        // const endTime = `2025-08-27 23:59:59`;

        return {startTime, endTime};
    };

    // Kiểm tra token trước khi vào trang
    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');

        if (!ylToken || ylToken === "" || ylToken === null) {
            // Không có token, chuyển hướng về trang chủ
            router.push('/');
            return;
        }

        // Có token, set vào state và cho phép tiếp tục
        setAuthToken(ylToken);
        setIsLoading(false);
    }, [router]);

    // Fetch data chỉ khi đã có authToken
    useEffect(() => {
        if (!authToken || isLoading) return;

        const {startTime, endTime} = getCurrentDateRange();

        // Gọi các API song song
        const apiCalls = [
            axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/miss_scan_arrival_deliver_total", {
                "current": 1,
                "size": 20,
                "scansitecode": "028M08",
                "countPage": "network",
                "startTime": startTime,
                "endTime": endTime,
                "dateType": "day",
                "countryId": "1"
            }, {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }),

            axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/miss_scan_arrival_deliver_update_time", {
                "current": 1,
                "size": 20,
                "scansitecode": "028M08",
                "countPage": "network",
                "startTime": startTime,
                "endTime": endTime,
                "dateType": "day",
                "countryId": "1"
            }, {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }),

            axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/miss_scan_arrival_deliver_sum", {
                "current": 1,
                "size": 20,
                "scansitecode": "028M08",
                "countPage": "network",
                "startTime": startTime,
                "endTime": endTime,
                "dateType": "day",
                "countryId": "1"
            }, {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            })
        ];

        // Chỉ lấy kết quả từ API thứ 3 để set arrivalMissNum
        apiCalls[2].then((resp: any) => {
            if (resp.data.data.records && resp.data.data.records.length > 0) {
                setArrivalMissNum(resp.data.data.records[0].arrival_miss_num);
            }
        }).catch((error) => {
            console.error('Error fetching arrival miss data:', error);
            // Xử lý lỗi - có thể token đã hết hạn
            if (error.response?.status === 401) {
                localStorage.removeItem('YL_TOKEN');
                router.push('/');
            }
        });

    }, [authToken, isLoading, router]);

    // Fetch bills khi có arrivalMissNum
    useEffect(() => {
        if (!authToken || arrivalMissNum === 0) return;

        const {startTime, endTime} = getCurrentDateRange();

        axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/miss_scan_detail", {
            "current": 1,
            "size": arrivalMissNum,
            "startTime": startTime,
            "endTime": endTime,
            "jump_tab": "arrival",
            "jump_type": "arr_miss",
            "deliversitecode": "028M08",
            "agentcode": "028001",
            "detailType": "arrival",
            "countryId": "1"
        }, {
            headers: {
                authToken: authToken,
                lang: 'VN',
                langType: 'VN',
            }
        }).then((resp: any) => {
            if (resp.data.data.records) {
                setBills(resp.data.data.records.map((record: any) => record.billcode));
            }
        }).catch((error) => {
            console.error('Error fetching bills:', error);
            // Xử lý lỗi - có thể token đã hết hạn
            if (error.response?.status === 401) {
                localStorage.removeItem('YL_TOKEN');
                router.push('/');
            }
        });
    }, [arrivalMissNum, authToken, router]);

    // Hiển thị loading trong khi kiểm tra token
    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <BillsTrackingSection bills={bills} authToken={authToken} isBillTracking={false}/>
        </div>
    );
}

export default Page;