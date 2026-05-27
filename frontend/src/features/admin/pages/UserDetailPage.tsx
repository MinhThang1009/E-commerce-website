/**
 * @file UserDetailPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';
import {
  User,
  Mail,
  Phone,
  Calendar,
  History,
  MapPin,
  ShoppingCart,
  ArrowLeft,
  Crown,
  CheckCircle,
  XCircle,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGetUserByIdQuery } from '../api/admin-user-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const UserDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: userData, isLoading, error } = useGetUserByIdQuery(id || '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- order fields dynamic from API
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (error || !userData) {
    return (
      <div className="p-6">
        <p className="text-center text-neutral-500 dark:text-neutral-400 py-12">
          {t('admin.userDetail.notFound')}
        </p>
        <div className="text-center mt-4">
          <Link to={ROUTES.ADMIN_USERS}>
            <Button variant="outline">
              <ArrowLeft className="size-4 mr-2" />
              {t('admin.userDetail.backToList')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { user } = userData.data;

  const getRoleTag = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <Crown className="size-3" />
            {t('admin.users.roles.admin')}
          </span>
        );
      case 'customer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <User className="size-3" />
            {t('admin.users.roles.customer')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300">
            {role}
          </span>
        );
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US');

  const getStatusColor = (status: string) => {
    if (status === 'delivered')
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (status === 'pending')
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (status === 'cancelled')
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
  };

  const getStatusLabel = (status: string) => {
    const key = `admin.dashboard.orderStatus.${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={ROUTES.ADMIN_USERS}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h3 className="text-xl font-semibold dark:text-white" style={{ margin: 0 }}>
              {t('admin.userDetail.title')}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('admin.userDetail.subtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Profile card */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <div className="h-24 bg-gradient-to-r from-primary-500 to-blue-600 rounded-t-2xl" />
              <CardContent className="text-center pt-0">
                <div className="-mt-12 mb-4">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-[100px] h-[100px] rounded-full border-4 border-white shadow-md bg-white mx-auto object-cover"
                    />
                  ) : (
                    <div className="w-[100px] h-[100px] rounded-full border-4 border-white shadow-md bg-neutral-200 dark:bg-neutral-700 mx-auto flex items-center justify-center">
                      <User className="size-10 text-neutral-500" />
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-semibold dark:text-white mb-1">
                  {user.firstName} {user.lastName}
                </h4>
                <div className="mb-4">{getRoleTag(user.role)}</div>

                <hr className="border-neutral-200 dark:border-neutral-700 my-4" />

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400 text-sm mb-1">
                    <ShoppingCart className="size-4" />
                    <span>{t('admin.userDetail.stats.orders')}</span>
                  </div>
                  <p className="text-2xl font-semibold dark:text-white">
                    {user.orders?.length || 0}
                  </p>
                </div>

                <hr className="border-neutral-200 dark:border-neutral-700 my-4" />

                <div className="space-y-3 text-left text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-neutral-400 shrink-0" />
                    <span className="dark:text-neutral-300 break-all">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-neutral-400 shrink-0" />
                    <span className="dark:text-neutral-300">
                      {user.phone || t('admin.userDetail.notUpdated')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-neutral-400 shrink-0" />
                    <span className="dark:text-neutral-300">
                      {t('admin.userDetail.joinedDate', { date: formatDate(user.createdAt) })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.userDetail.accountStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t('admin.userDetail.activeLabel')}
                    </span>
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="size-3" />
                        {t('admin.userDetail.activeStatus')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        <XCircle className="size-3" />
                        {t('admin.userDetail.lockedStatus')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t('admin.userDetail.emailVerifyLabel')}
                    </span>
                    {user.isEmailVerified ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {t('admin.userDetail.verified')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        {t('admin.userDetail.notVerified')}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Tabs */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <Tabs defaultValue="orders">
                <TabsList>
                  <TabsTrigger value="orders" className="gap-1">
                    <ShoppingCart className="size-4" />
                    {t('admin.userDetail.tabs.orders')}
                  </TabsTrigger>
                  <TabsTrigger value="addresses" className="gap-1">
                    <MapPin className="size-4" />
                    {t('admin.userDetail.tabs.addresses')}
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-1">
                    <History className="size-4" />
                    {t('admin.userDetail.tabs.activity')}
                  </TabsTrigger>
                </TabsList>

                {/* Orders Tab */}
                <TabsContent value="orders">
                  <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                          <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                            {t('admin.userDetail.orderColumns.code')}
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                            {t('admin.userDetail.orderColumns.createdAt')}
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                            {t('common.status')}
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                            {t('admin.userDetail.orderColumns.total')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.orders && user.orders.length > 0 ? (
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic order fields
                          user.orders.map((order: any) => (
                            <tr
                              key={order.id}
                              className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                            >
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrder(order)}
                                  className="font-medium text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 hover:underline cursor-pointer"
                                >
                                  #{order.number || order.id.substring(0, 8)}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(order.status)}`}
                                >
                                  {getStatusLabel(order.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold dark:text-white">
                                {Number(order.total).toLocaleString(
                                  i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                                  { maximumFractionDigits: 0 },
                                )}
                                {t('common.currencySymbol')}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="text-center py-12 text-neutral-500 dark:text-neutral-400"
                            >
                              {t('admin.userDetail.noOrders')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Addresses Tab */}
                <TabsContent value="addresses">
                  {user.addresses?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Address fields dynamic */}
                      {user.addresses.map((addr: any) => (
                        <Card key={addr.id} className="h-full">
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <span className="font-semibold dark:text-white">
                                {addr.firstName} {addr.lastName}
                              </span>
                              {addr.isDefault && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                  {t('admin.userDetail.defaultAddress')}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                              <p>{addr.phone}</p>
                              <p>{addr.addressLine1}</p>
                              {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                              <p>
                                {addr.city}, {addr.state} {addr.zipCode}
                              </p>
                              <p>{addr.country}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                      {t('admin.userDetail.noAddresses')}
                    </p>
                  )}
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity">
                  <div className="mt-4 space-y-4">
                    {(user.searchHistories || [])
                      .sort(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (a: any, b: any) =>
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                      )
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .map((s: any, index: number) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <p className="text-sm text-neutral-700 dark:text-neutral-300">
                            {new Date(s.createdAt).toLocaleString(
                              i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                            )}
                            : {t('admin.userDetail.activity.search')} &quot;
                            {s.keyword || s.query || 'N/A'}&quot;
                          </p>
                        </div>
                      ))}
                    {(!user.searchHistories || user.searchHistories.length === 0) && (
                      <p className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                        {t('common.noData')}
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5" />
              {t('admin.userDetail.orderDialog.title')}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <td className="px-4 py-2.5 font-medium bg-neutral-50 dark:bg-neutral-800 w-[140px]">
                        {t('admin.userDetail.orderDialog.orderNumber')}
                      </td>
                      <td className="px-4 py-2.5 font-semibold dark:text-white">
                        #{selectedOrder.number || selectedOrder.id?.substring(0, 8)}
                      </td>
                    </tr>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <td className="px-4 py-2.5 font-medium bg-neutral-50 dark:bg-neutral-800">
                        {t('admin.userDetail.orderDialog.orderDate')}
                      </td>
                      <td className="px-4 py-2.5 dark:text-neutral-300">
                        {formatDate(selectedOrder.createdAt)}
                      </td>
                    </tr>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <td className="px-4 py-2.5 font-medium bg-neutral-50 dark:bg-neutral-800">
                        {t('admin.userDetail.orderDialog.status')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedOrder.status)}`}
                        >
                          {getStatusLabel(selectedOrder.status)}
                        </span>
                      </td>
                    </tr>
                    {selectedOrder.paymentStatus && (
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <td className="px-4 py-2.5 font-medium bg-neutral-50 dark:bg-neutral-800">
                          {t('admin.userDetail.orderDialog.paymentStatus')}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              selectedOrder.paymentStatus === 'paid'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : selectedOrder.paymentStatus === 'failed'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {t(
                              `admin.userDetail.orderDialog.payment${selectedOrder.paymentStatus.charAt(0).toUpperCase() + selectedOrder.paymentStatus.slice(1)}`,
                            )}
                          </span>
                        </td>
                      </tr>
                    )}
                    {selectedOrder.paymentMethod && (
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <td className="px-4 py-2.5 font-medium bg-neutral-50 dark:bg-neutral-800">
                          {t('admin.userDetail.orderDialog.paymentMethod')}
                        </td>
                        <td className="px-4 py-2.5 dark:text-neutral-300">
                          {selectedOrder.paymentMethod === 'cod'
                            ? t('admin.userDetail.orderDialog.cod')
                            : selectedOrder.paymentMethod.toUpperCase()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial summary */}
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-2 text-sm">
                {selectedOrder.subtotal != null && (
                  <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                    <span>{t('admin.userDetail.orderDialog.subtotal')}</span>
                    <span>
                      {Number(selectedOrder.subtotal).toLocaleString(
                        i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                        { maximumFractionDigits: 0 },
                      )}
                      {t('common.currencySymbol')}
                    </span>
                  </div>
                )}
                {selectedOrder.shippingCost != null && Number(selectedOrder.shippingCost) > 0 && (
                  <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                    <span>{t('admin.userDetail.orderDialog.shipping')}</span>
                    <span>
                      {Number(selectedOrder.shippingCost).toLocaleString(
                        i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                        { maximumFractionDigits: 0 },
                      )}
                      {t('common.currencySymbol')}
                    </span>
                  </div>
                )}
                {selectedOrder.discount != null && Number(selectedOrder.discount) > 0 && (
                  <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                    <span>{t('admin.userDetail.orderDialog.discount')}</span>
                    <span className="text-red-500">
                      -
                      {Number(selectedOrder.discount).toLocaleString(
                        i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                        { maximumFractionDigits: 0 },
                      )}
                      {t('common.currencySymbol')}
                    </span>
                  </div>
                )}
                <hr className="border-neutral-200 dark:border-neutral-700" />
                <div className="flex justify-between font-semibold dark:text-white">
                  <span>{t('admin.userDetail.orderDialog.total')}</span>
                  <span>
                    {Number(selectedOrder.total).toLocaleString(
                      i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                      { maximumFractionDigits: 0 },
                    )}
                    {t('common.currencySymbol')}
                  </span>
                </div>
              </div>

              <Link to={ROUTES.ADMIN_ORDERS} onClick={() => setSelectedOrder(null)}>
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="size-4" />
                  {t('admin.userDetail.orderDialog.viewInOrders')}
                </Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDetailPage;
