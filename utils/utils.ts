import {
    SCAN_TYPE_TRANSLATIONS,
    SCAN_TYPE_COLORS,
    DEFAULT_SCAN_TYPE_COLOR,
    getStatusColor
} from "@/lib/constants";

// Utility functions
export const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};

export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

export const calculateStoppedDays = (scanTime: string): number => {
    if (!scanTime) return 0;
    const scanDate = new Date(scanTime);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - scanDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

export const translateScanType = (scanTypeName: string): string => {
    return SCAN_TYPE_TRANSLATIONS[scanTypeName] || scanTypeName;
};

export const getScanTypeColor = (scanType: string): string => {
    return SCAN_TYPE_COLORS[scanType] || DEFAULT_SCAN_TYPE_COLOR;
};

export const parseTerminalDispatchCode = (code: string) => {
    if (!code) return { prefix: '', remaining: '' };

    const parts = code.split('-');
    if (parts.length >= 2) {
        return {
            prefix: parts[0], // 800
            remaining: parts.slice(1).join('-') // A028S05-012
        };
    }
    return { prefix: code, remaining: '' };
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy: ', err);
        return false;
    }
};

export const validateDates = (start: string, end: string): { isValid: boolean; error: string } => {
    if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (startDate > endDate) {
            return {
                isValid: false,
                error: 'Ngày kết thúc phải sau ngày bắt đầu'
            };
        }
    }
    return { isValid: true, error: '' };
};

export const formatDateTime = (dateTime: string): string => {
    if (!dateTime) return '--';
    try {
        const date = new Date(dateTime);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateTime;
    }
};

export const getPageNumbers = (currentPage: number, totalPages: number, showPages: number = 5): number[] => {
    const pages = [];

    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    return pages;
};

// Retry logic for API calls
export const retryApiCall = async <T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
): Promise<T> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                throw lastError;
            }

            console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
            await delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
    }

    throw lastError!;
};

// Auto-detect token from storage
export const detectStoredToken = (): string | null => {
    const tokenKeys = [
        'authToken', 'token', 'access_token', 'accessToken',
        'jwt', 'jwtToken', 'authorization', 'auth',
        'user_token', 'session_token', 'YL_TOKEN'
    ];

    for (const key of tokenKeys) {
        const token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (token && token.length > 10) { // Basic validation
            console.log(`Found token in ${key}:`, token.substring(0, 20) + '...');
            return token;
        }
    }

    return null;
};

// Batch processing with concurrency control
export const processBatchesConcurrently = async <T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[], batchIndex: number) => Promise<R[]>,
    concurrentBatches: number = 5,
    delayBetweenBatches: number = 200
): Promise<R[]> => {
    const batches = chunkArray(items, batchSize);
    const results: R[] = [];

    console.log(`Processing ${items.length} items in ${batches.length} batches with ${concurrentBatches} concurrent batches`);

    for (let i = 0; i < batches.length; i += concurrentBatches) {
        const currentBatchGroup = batches.slice(i, i + concurrentBatches);

        console.log(`Processing batch group ${Math.floor(i / concurrentBatches) + 1}/${Math.ceil(batches.length / concurrentBatches)}`);

        const batchPromises = currentBatchGroup.map((batch, index) => {
            const globalBatchIndex = i + index;
            return processor(batch, globalBatchIndex);
        });

        try {
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.flat());

            console.log(`Completed batch group, total processed: ${results.length}`);

            // Add delay between batch groups to avoid overwhelming the server
            if (i + concurrentBatches < batches.length && delayBetweenBatches > 0) {
                await delay(delayBetweenBatches);
            }
        } catch (error) {
            console.error(`Error in batch group ${Math.floor(i / concurrentBatches) + 1}:`, error);
            // Continue with other batches instead of failing completely
        }
    }

    return results;
};