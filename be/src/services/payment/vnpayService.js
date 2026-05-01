const moment = require('moment');
const crypto = require('crypto');
const querystring = require('qs');

class VNPayService {
  constructor() {
    this.tmnCode = process.env.VNP_TMN_CODE;
    this.secretKey = process.env.VNP_HASH_SECRET;
    this.vnpUrl = process.env.VNP_URL;
    this.returnUrl = process.env.VNP_RETURN_URL;
  }

  createPaymentUrl({ orderId, amount, ipAddr, orderInfo, locale = 'vn' }) {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');

    const currCode = 'VND';
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = this.tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = orderInfo || 'Thanh toan cho ma GD:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = Math.round(amount * 100);
    vnp_Params['vnp_ReturnUrl'] = this.returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;

    vnp_Params = this.sortObject(vnp_Params);

    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', this.secretKey);
    const signed = hmac.update(new Buffer(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;

    const queryUrl = querystring.stringify(vnp_Params, { encode: false });
    return this.vnpUrl + '?' + queryUrl;
  }

  verifyReturnUrl(params) {
    let vnp_Params = { ...params };
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = this.sortObject(vnp_Params);

    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', this.secretKey);
    const signed = hmac.update(new Buffer(signData, 'utf-8')).digest('hex');

    return secureHash === signed;
  }

  async refund({
    orderId,
    amount,
    transDate,
    transType = '02',
    user = 'Admin',
    ipAddr,
  }) {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    const date = new Date();
    const vnp_Api = process.env.VNP_API;
    const vnp_TmnCode = this.tmnCode;
    const secretKey = this.secretKey;

    const vnp_RequestId = moment(date).format('HHmmss');
    const vnp_Version = '2.1.0';
    const vnp_Command = 'refund';
    const vnp_OrderInfo = 'Hoan tien GD ma:' + orderId;
    const vnp_Amount = Math.round(amount * 100);
    const vnp_CreateDate = moment(date).format('YYYYMMDDHHmmss');
    const vnp_TransactionNo = '0'; // If unknown
    const vnp_TransactionDate = transDate; // Format YYYYMMDDHHmmss
    const vnp_CreateBy = user;

    const data =
      vnp_RequestId +
      '|' +
      vnp_Version +
      '|' +
      vnp_Command +
      '|' +
      vnp_TmnCode +
      '|' +
      transType +
      '|' +
      orderId +
      '|' +
      vnp_Amount +
      '|' +
      vnp_TransactionNo +
      '|' +
      vnp_TransactionDate +
      '|' +
      vnp_CreateBy +
      '|' +
      vnp_CreateDate +
      '|' +
      ipAddr +
      '|' +
      vnp_OrderInfo;

    const hmac = crypto.createHmac('sha512', secretKey);
    const vnp_SecureHash = hmac.update(new Buffer(data, 'utf-8')).digest('hex');

    const dataObj = {
      vnp_RequestId,
      vnp_Version,
      vnp_Command,
      vnp_TmnCode,
      vnp_TransactionType: transType,
      vnp_TxnRef: orderId,
      vnp_Amount,
      vnp_TransactionNo,
      vnp_CreateBy,
      vnp_OrderInfo,
      vnp_TransactionDate,
      vnp_CreateDate,
      vnp_IpAddr: ipAddr,
      vnp_SecureHash,
    };

    const axios = require('axios');
    const response = await axios.post(vnp_Api, dataObj);
    return response.data;
  }

  sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
    }
    return sorted;
  }
}

module.exports = new VNPayService();
