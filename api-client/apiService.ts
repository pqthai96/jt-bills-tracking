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

    // Get sum data to determine total number of bills
    async getSumData(startTime: string, endTime: string): Promise<number> {
        const response = await retryApiCall(async () => {
            return await axios.post(API_ENDPOINTS.SUM_DATA, {
                current: 1,
                size: 20,
                dimensionType: 336,
                takingNetworkCode: [NETWORK_CODE],
                startTime: `${startTime} 00:00:00`,
                endTime: `${endTime} 23:59:59`,
                countryId: "1"
            }, {
                headers: this.getHeaders(),
                timeout: API_CONFIG.REQUEST_TIMEOUT
            });
        });

        return response.data.data.records[0].takingTotal;
    }

    // Get all bills data
    async getAllBills(takingTotal: number, startTime: string, endTime: string): Promise<BillData[]> {
        const response = await retryApiCall(async () => {
            return await axios.post(API_ENDPOINTS.DETAIL_DATA, {
                current: 1,
                size: takingTotal,
                takingNetworkCode: NETWORK_CODE,
                dimensionType: "takingTotal",
                startTime: `${startTime} 00:00:00`,
                endTime: `${endTime} 23:59:59`,
                countryId: "1"
            }, {
                headers: this.getHeaders(),
                timeout: API_CONFIG.REQUEST_TIMEOUT
            });
        });

        return response.data.data.records;
    }

    // Get bill status in optimized batches
    async getBillsWithStatus(billsData: BillData[]): Promise<BillWithStatus[]> {
        const billCodes = billsData.map(item => item.billCode);
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
                return response.data?.data?.records || [];
            } catch (error) {
                console.error(`Error in status batch ${batchIndex + 1}:`, error);
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
    async getBillsWithTerminalCodes(billsWithStatus: BillWithStatus[]): Promise<BillWithTerminalCode[]> {
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
    async getAllBillsData(startTime: string, endTime: string): Promise<{
        allBills: BillData[];
        billsWithStatus: BillWithStatus[];
        billsWithTerminalCodes: BillWithTerminalCode[];
    }> {
        try {
            // Step 1: Get total count
            console.log('Step 1: Getting total count...');
            const takingTotal = await this.getSumData(startTime, endTime);
            console.log('Total bills to process:', takingTotal);

            // Step 2: Get all bills
            console.log('Step 2: Getting all bills...');
            const allBills = await this.getAllBills(takingTotal, startTime, endTime);
            console.log('Retrieved bills:', allBills.length);

            // Step 3: Get status for all bills (optimized)
            console.log('Step 3: Getting bill statuses...');
            const billsWithStatus = await this.getBillsWithStatus(allBills);
            console.log('Bills with status:', billsWithStatus.length);

            // Step 4: Get terminal codes (optimized)
            console.log('Step 4: Getting terminal codes...');
            const billsWithTerminalCodes = await this.getBillsWithTerminalCodes(billsWithStatus);
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