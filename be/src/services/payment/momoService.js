const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class MoMoService {
  constructor() {
    this.partnerCode = process.env.DEV_PARTNER_CODE || process.env.MOMO_PARTNER_CODE || 'MOMOLRJZ20181206';
    this.accessKey = process.env.DEV_ACCESS_KEY || process.env.MOMO_ACCESS_KEY || 'mTCKt9W3eU1m39TW';
    this.secretKey = process.env.DEV_SECRET_KEY || process.env.MOMO_SECRET_KEY || 'SetA5RDnLHvt51AULf51DyauxUo3kDU6';
    // The base Endpoint is https://test-payment.momo.vn/v2/gateway/api
    this.apiEndpoint = process.env.DEV_MOMO_ENDPOINT ? `${process.env.DEV_MOMO_ENDPOINT}/create` : (process.env.MOMO_API_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create');
    
    // Set to Backend return URL so it can process payment status
    this.redirectUrl = process.env.MOMO_REDIRECT_URL || 'http://localhost:8888/api/payment/momo/return';
    this.ipnUrl = process.env.MOMO_IPN_URL || 'http://localhost:8888/api/payment/momo/ipn';
  }

  async createPaymentUrl({ orderId, amount, orderInfo, extraData = '' }) {
    // MoMo amount must be integer
    const intAmount = Math.round(amount);
    
    // MoMo orderId must be unique for each transaction attempt
    const momoOrderId = `${orderId}-${Date.now().toString().slice(-6)}`;
    const requestId = `${momoOrderId}-${uuidv4().split('-')[0]}`;
    const requestType = 'payWithATM';
    
    // Create signature
    const rawSignature = `accessKey=${this.accessKey}&amount=${intAmount}&extraData=${extraData}&ipnUrl=${this.ipnUrl}&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${this.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'E-commerce Mini',
      storeId: 'E-commerce-Store',
      requestId,
      amount: intAmount,
      orderId: momoOrderId,
      orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      lang: 'vi',
      extraData,
      requestType,
      signature,
    };

    try {
      const response = await axios.post(this.apiEndpoint, requestBody);
      return response.data;
    } catch (error) {
      console.error('MoMo Create Payment Error:', error.response?.data || error.message);
      throw new Error(JSON.stringify(error.response?.data || error.message));
    }
  }

  verifySignature(params) {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = params;

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    
    const checkSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    return checkSignature === signature;
  }
}

module.exports = new MoMoService();
