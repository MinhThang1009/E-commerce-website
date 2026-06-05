/**
 * @file vnpayService.js
 * @layer Service
 * @module payment
 * @description Business logic layer cho payment
 */
const moment = require('moment');
const crypto = require('crypto');
const querystring = require('qs');
const axios = require('axios');
const logger = require('@utils/logger');

class VNPayService {
  constructor() {
    this.tmnCode = process.env.VNP_TMN_CODE;
    this.secretKey = process.env.VNP_HASH_SECRET;
    this.vnpUrl = process.env.VNP_URL;
    this.returnUrl = process.env.VNP_RETURN_URL;
  }

  createPaymentUrl({ orderId, amount, ipAddr, orderInfo, locale = 'vn' }) {
    const createDate = moment().utcOffset('+07:00').format('YYYYMMDDHHmmss');

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
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
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
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (!secureHash || secureHash.length !== signed.length) return false;
    return crypto.timingSafeEqual(Buffer.from(secureHash), Buffer.from(signed));
  }

  async refund({ orderId, amount, transDate, transType = '02', user = 'Admin', ipAddr }) {
    const vnp_Api = process.env.VNP_API;
    const vnp_TmnCode = this.tmnCode;
    const secretKey = this.secretKey;

    const vnp_RequestId = moment().utcOffset('+07:00').format('HHmmss');
    const vnp_Version = '2.1.0';
    const vnp_Command = 'refund';
    const vnp_OrderInfo = 'Hoan tien GD ma:' + orderId;
    const vnp_Amount = Math.round(amount * 100);
    const vnp_CreateDate = moment().utcOffset('+07:00').format('YYYYMMDDHHmmss');
    const vnp_TransactionNo = '0'; // Nếu không xác định
    const vnp_TransactionDate = transDate; // Định dạng YYYYMMDDHHmmss
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
    const vnp_SecureHash = hmac.update(Buffer.from(data, 'utf-8')).digest('hex');

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

    try {
      const response = await axios.post(vnp_Api, dataObj, { timeout: 30000 });
      return response.data;
    } catch (error) {
      logger.error('Lỗi hoàn tiền VNPay:', error.response?.data || error.message);
      throw new Error(JSON.stringify(error.response?.data || error.message));
    }
  }

  sortObject(obj) {
    const sorted = {};
    const str = [];
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
