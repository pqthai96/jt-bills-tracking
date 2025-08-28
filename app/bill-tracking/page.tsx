"use client";

import React, {useEffect, useState} from 'react';
import BillsTrackingSection from "@/components/bills-tracking/bills-tracking-section";
import { useRouter } from 'next/navigation';

function Page() {

    const router = useRouter();
    const [authToken, setAuthToken] = useState<string>("");

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
    }, [router]);

    return (
        <div>
            <BillsTrackingSection bills={[]} authToken={authToken} isBillTracking={true}/>
        </div>
    );
}

export default Page;