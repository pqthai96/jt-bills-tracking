// API Endpoints
export const API_ENDPOINTS = {
    SUM_DATA: "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/op_taking_monitor_sum",
    DETAIL_DATA: "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/op_taking_monitor_detail",
    STATUS_DATA: "https://jmsgw.jtexpress.vn/operatingplatform/wayBillStatusNew/listPage",
    ORDER_DETAIL: "https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail"
} as const;

// Scan type options
export const SCAN_TYPE_OPTIONS = [
    "Quét mã gửi hàng",
    "Ký nhận CPN",
    "Hàng đến TTTC",
    "Quét kiện vấn đề",
    "Đã chuyển hoàn",
    "Quét phát hàng",
    "Giao lại hàng",
    "Đang chuyển hoàn",
    "Đăng ký chuyển hoàn",
    "Đóng bao",
    "Quét hàng đến",
    "Gỡ bao",
    "Nhận hàng",
    "Đăng ký CH lần 2",
    "In đơn chuyển hoàn",
    "Kết thúc",
    "Xác nhận chuyển đơn"
] as const;

// Translations for scan types
export const SCAN_TYPE_TRANSLATIONS: Record<string, string> = {
    "发件扫描": "Quét mã gửi hàng",
    "快件签收": "Ký nhận CPN",
    "中心到件": "Hàng đến TTTC",
    "问题件扫描": "Quét kiện vấn đề",
    "退件签收": "Đã chuyển hoàn",
    "出仓扫描": "Quét phát hàng",
    "重派": "Giao lại hàng",
    "退件确认": "Đang chuyển hoàn",
    "退件登记": "Đăng ký chuyển hoàn",
    "建包扫描": "Đóng bao",
    "到件扫描": "Quét hàng đến",
    "拆包扫描": "Gỡ bao",
    "快件揽收": "Nhận hàng",
    "再次登记": "Đăng ký CH lần 2",
    "退件扫描": "In đơn chuyển hoàn",
    "完结": "Kết thúc",
    "转单确认": "Xác nhận chuyển đơn"
} as const;

// Scan type colors
export const SCAN_TYPE_COLORS: Record<string, string> = {
    "Ký nhận CPN": 'bg-green-100 text-green-800',
    "Quét kiện vấn đề": 'bg-red-100 text-red-800',
    "Đã chuyển hoàn": 'bg-gray-100 text-gray-800',
    "Đang chuyển hoàn": 'bg-gray-100 text-gray-800',
    "Đăng ký chuyển hoàn": 'bg-gray-100 text-gray-800',
    "Đăng ký CH lần 2": 'bg-gray-100 text-gray-800',
    "In đơn chuyển hoàn": 'bg-gray-100 text-gray-800',
    "Quét mã gửi hàng": 'bg-blue-100 text-blue-800',
    "Nhận hàng": 'bg-blue-100 text-blue-800',
    "Hàng đến TTTC": 'bg-purple-100 text-purple-800',
    "Quét hàng đến": 'bg-purple-100 text-purple-800',
    "Quét phát hàng": 'bg-orange-100 text-orange-800',
    "Giao lại hàng": 'bg-orange-100 text-orange-800',
    "Kết thúc": 'bg-emerald-100 text-emerald-800'
} as const;

// Default scan type color
export const DEFAULT_SCAN_TYPE_COLOR = 'bg-indigo-100 text-indigo-800';

// Status colors based on stopped days
export const getStatusColor = (daysStopped: number): string => {
    if (daysStopped >= 7) return 'text-red-600 bg-red-50';
    if (daysStopped >= 3) return 'text-orange-600 bg-orange-50';
    if (daysStopped >= 1) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
};

// API configuration
export const API_CONFIG = {
    BATCH_SIZE: 1000,
    CONCURRENT_BATCH_SIZE: 50,
    REQUEST_TIMEOUT: 10000,
    BATCH_DELAY: 200,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
} as const;

// Network code
export const NETWORK_CODE = "028M08";

// Token storage keys to search for
export const TOKEN_KEYS = [
    'authToken', 'token', 'access_token', 'accessToken',
    'jwt', 'jwtToken', 'authorization', 'auth',
    'user_token', 'session_token', 'YL_TOKEN'
] as const;

// Items per page options
export const ITEMS_PER_PAGE_OPTIONS = [50, 100, 200, 500] as const;

// Default pagination
export const DEFAULT_ITEMS_PER_PAGE = 100;
export const DEFAULT_PAGE = 1;
export const PAGINATION_SHOW_PAGES = 5;