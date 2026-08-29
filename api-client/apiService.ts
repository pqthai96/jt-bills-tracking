import {
    API_ENDPOINTS,
    API_CONFIG,
    NETWORK_CODE
} from "@/lib/constants";
import {
    chunkArray,
    delay,
    parseTerminalDispatchCode,
    processBatchesConcurrently,
    retryApiCall
} from "@/utils/utils";

const axios = require('axios');

export interface BillData {
    billCode: string;

    [key: string]: any;
}

export interface BillWithStatus extends BillData {
    scanTime: string;
    scanTypeName: string;
    scanNetworkCode: string;
    scanByName: string;
    waybillTrackingContent: string;
}

export interface BillWithTerminalCode extends BillWithStatus {
    terminalDispatchCode: string;
    terminalPrefix: string;
    terminalRemaining: string;
}

// ─── Progress callback: (đã xong, tổng số) ──────────────────────────────────
export type ProgressCallback = (done: number, total: number) => void;

export class ApiService {
    private authToken: string;

    constructor(authToken: string) {
        this.authToken = authToken;
    }

    private getHeaders() {
        return {
            authToken: this.authToken,
            lang: 'VN',
            langType: 'VN',
        };
    }

    // Headers riêng cho request dạng form-urlencoded (SUM_DATA, DETAIL_DATA)
    private getFormHeaders() {
        return {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
        };
    }

    // Build form-urlencoded params, tự bỏ qua field undefined/null
    private buildFormParams(fields: Record<string, string | number | undefined>): URLSearchParams {
        const params = new URLSearchParams();
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        return params;
    }

    // Get sum data to determine total number of bills
    async getSumData(startTime: string, endTime: string, agentCode: string): Promise<number> {
        const formParams = this.buildFormParams({
            current: 1,
            size: 20,
            pickFinanceCode: agentCode,
            timeStart: `${startTime} 00:00:00`,
            timeEnd: `${endTime} 23:59:59`,
            inputTimeStart: `${startTime} 00:00:00`,
            inputTimeEnd: `${endTime} 23:59:59`,
            searchTimeType: 1,
            waybillNos: "",
            customerCodes: "",
        });

        const response = await retryApiCall(async () => {
            return await axios.post(API_ENDPOINTS.SUM_DATA, formParams, {
                headers: this.getFormHeaders(),
                timeout: API_CONFIG.REQUEST_TIMEOUT
            });
        });
        return response.data.data;
    }

    // Get all bills data — API giới hạn cứng 100 bản ghi/lần gọi (tham số `size`),
    // nên nếu takingTotal > 100 phải chia trang: current = 1, 2, 3, ..., totalPages
    // rồi gộp kết quả các trang lại thành 1 mảng duy nhất.
    async getAllBills(
        takingTotal: number,
        startTime: string,
        endTime: string,
        agentCode: string,
        onProgress?: (fetched: number) => void
    ): Promise<BillData[]> {
        const PAGE_SIZE = 100; // giới hạn cứng của API, không tăng quá số này
        const totalPages = Math.max(1, Math.ceil(takingTotal / PAGE_SIZE));

        const fetchPage = async (page: number): Promise<BillData[]> => {
            const formParams = this.buildFormParams({
                current: page,     // trang 1, 2, 3, ..., totalPages
                size: PAGE_SIZE,   // luôn cố định = 100
                pickFinanceCode: agentCode,
                timeStart: `${startTime} 00:00:00`,
                timeEnd: `${endTime} 23:59:59`,
                inputTimeStart: `${startTime} 00:00:00`,
                inputTimeEnd: `${endTime} 23:59:59`,
                waybillNos: "",
                customerCodes: "",
            });

            const response = await retryApiCall(async () => {
                return await axios.post(API_ENDPOINTS.DETAIL_DATA, formParams, {
                    headers: this.getFormHeaders(),
                    timeout: API_CONFIG.REQUEST_TIMEOUT
                });
            });

            return response.data?.data || [];
        };

        // Gọi tuần tự từng trang để tránh bắn quá nhiều request cùng lúc
        // (dễ bị rate-limit/chặn IP nếu gọi song song nhiều chục trang).
        const allBills: BillData[] = [];
        for (let page = 1; page <= totalPages; page++) {
            const pageData = await fetchPage(page);
            allBills.push(...pageData);
            onProgress?.(allBills.length);

            // Trang trả về ít hơn PAGE_SIZE nghĩa là đã hết dữ liệu thật sự -> dừng sớm
            // (phòng trường hợp takingTotal từ SUM_DATA lệch nhẹ so với DETAIL_DATA)
            if (pageData.length < PAGE_SIZE) break;
        }

        console.log(`getAllBills: fetched ${allBills.length}/${takingTotal} bills across ${totalPages} page(s)`);
        return allBills;
    }

    // Get bill status in optimized batches
    // onBatchDone: gọi sau mỗi batch xử lý xong (dù thành công hay lỗi) với số lượng item vừa xong
    async getBillsWithStatus(billsData: BillData[], onBatchDone?: (count: number) => void): Promise<BillWithStatus[]> {
        const billCodes = billsData.map(item => item.waybillNo);
        console.log('Total bill codes to process:', billCodes.length);

        const processor = async (batch: string[], batchIndex: number): Promise<BillWithStatus[]> => {
            try {
                const response = await retryApiCall(async () => {
                    return await axios.post(API_ENDPOINTS.STATUS_DATA, {
                        current: 1,
                        size: batch.length,
                        billNoList: batch,
                        countryId: "1"
                    }, {
                        headers: this.getHeaders(),
                        timeout: API_CONFIG.REQUEST_TIMEOUT
                    });
                });

                console.log(`Status batch ${batchIndex + 1} completed (${batch.length} items)`);
                onBatchDone?.(batch.length);
                return response.data?.data?.records || [];
            } catch (error) {
                console.error(`Error in status batch ${batchIndex + 1}:`, error);
                onBatchDone?.(batch.length);
                return [];
            }
        };

        const results = await processBatchesConcurrently(
            billCodes,
            API_CONFIG.BATCH_SIZE,
            processor,
            API_CONFIG.CONCURRENT_BATCH_SIZE,
            API_CONFIG.BATCH_DELAY
        );

        console.log('Total status results:', results.length);
        return results;
    }

    // Get terminal codes with optimized concurrent processing
    // onBatchDone: gọi sau mỗi batch xử lý xong với số lượng item vừa xong
    async getBillsWithTerminalCodes(billsWithStatus: BillWithStatus[], onBatchDone?: (count: number) => void): Promise<BillWithTerminalCode[]> {
        console.log('Getting terminal codes for', billsWithStatus.length, 'bills');

        const processor = async (batch: BillWithStatus[], batchIndex: number): Promise<BillWithTerminalCode[]> => {
            const batchPromises = batch.map(async (bill): Promise<BillWithTerminalCode> => {
                try {
                    const response = await retryApiCall(async () => {
                        return await axios.post(API_ENDPOINTS.ORDER_DETAIL, {
                            waybillNo: bill.billCode,
                            countryId: "1"
                        }, {
                            headers: this.getHeaders(),
                            timeout: API_CONFIG.REQUEST_TIMEOUT
                        });
                    });

                    const terminalDispatchCode = response.data?.data?.details?.terminalDispatchCode || '';
                    const parsed = parseTerminalDispatchCode(terminalDispatchCode);

                    return {
                        ...bill,
                        terminalDispatchCode,
                        terminalPrefix: parsed.prefix,
                        terminalRemaining: parsed.remaining
                    };
                } catch (error) {
                    console.error(`Error loading terminal code for ${bill.billCode}:`, error);
                    return {
                        ...bill,
                        terminalDispatchCode: '',
                        terminalPrefix: '',
                        terminalRemaining: ''
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            console.log(`Terminal codes batch ${batchIndex + 1} completed`);
            onBatchDone?.(batchResults.length);
            return batchResults;
        };

        const results = await processBatchesConcurrently(
            billsWithStatus,
            API_CONFIG.CONCURRENT_BATCH_SIZE, // Smaller batch size for terminal code calls
            processor,
            5, // Even fewer concurrent batches for terminal calls
            API_CONFIG.BATCH_DELAY * 2 // Longer delay between batches
        );

        console.log('Total terminal code results:', results.length);
        return results;
    }

    // Main method to get all data with optimized performance
    // onProgress(done, total): báo tiến độ tổng hợp qua CẢ 3 bước
    // (lấy list bill, lấy trạng thái, lấy mã đoạn) để thanh tiến độ chạy mượt xuyên suốt,
    // không đứng im ở bước lấy list như trước.
    async getAllBillsData(
        startTime: string,
        endTime: string,
        agentCode: string,
        onProgress?: ProgressCallback
    ): Promise<{
        allBills: BillData[];
        billsWithStatus: BillWithStatus[];
        billsWithTerminalCodes: BillWithTerminalCode[];
    }> {
        try {
            // Step 1: Get total count
            console.log('Step 1: Getting total count...');
            const takingTotal = await this.getSumData(startTime, endTime, agentCode);
            console.log('Total bills to process:', takingTotal);

            // Tổng số "đơn vị công việc" = takingTotal * 3 bước
            // (lấy list, lấy status, lấy terminal code) để progress bar chạy mượt xuyên suốt.
            const totalUnits = Math.max(takingTotal, 1) * 3;
            let doneUnits = 0;
            onProgress?.(0, totalUnits);

            // Step 2: Get all bills (phân trang, size=100/lần, current tăng dần)
            console.log('Step 2: Getting all bills...');
            const allBills = await this.getAllBills(takingTotal, startTime, endTime, agentCode, (fetched) => {
                // fetched là tổng số bill đã lấy được tính từ đầu bước 2 (không phải delta)
                onProgress?.(fetched, totalUnits);
            });
            doneUnits = allBills.length;
            console.log('Retrieved bills:', allBills.length);
            onProgress?.(doneUnits, totalUnits);

            // Step 3: Get status for all bills (optimized)
            console.log('Step 3: Getting bill statuses...');
            const billsWithStatus = await this.getBillsWithStatus(allBills, (count) => {
                doneUnits += count;
                onProgress?.(doneUnits, totalUnits);
            });
            console.log('Bills with status:', billsWithStatus.length);

            // Step 4: Get terminal codes (optimized)
            console.log('Step 4: Getting terminal codes...');
            const billsWithTerminalCodes = await this.getBillsWithTerminalCodes(billsWithStatus, (count) => {
                doneUnits += count;
                onProgress?.(doneUnits, totalUnits);
            });
            console.log('Bills with terminal codes:', billsWithTerminalCodes.length);

            return {
                allBills,
                billsWithStatus,
                billsWithTerminalCodes
            };
        } catch (error) {
            console.error('Error in getAllBillsData:', error);
            throw error;
        }
    }
}

// Export a factory function to create API service
export const createApiService = (authToken: string): ApiService => {
    return new ApiService(authToken);
};