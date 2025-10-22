// src/api/controllers/customerAddress.controller.ts
import { Request, Response, NextFunction } from 'express';
import { User } from '../../types/authentication/user.type';
import * as AddressModel from '../../models/locations/customer_address.model';
import * as CustomerModel from '../../models/authentication/customer.model';

export const getCustomerAddresses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        const addresses = await AddressModel.getAddressesByCustomerId(customer.id);
        res.status(200).json(addresses);
    } catch (error) {
        next(error);
    }
};

export const addCustomerAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        const newAddress = await AddressModel.createAddress(customer.id, req.body);
        res.status(201).json(newAddress);
    } catch (error) {
        next(error);
    }
};

export const updateCustomerAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        const addressId = parseInt(req.params.addressId, 10);
        const updatedAddress = await AddressModel.updateAddress(addressId, customer.id, req.body);
        if (!updatedAddress) {
            return res.status(404).json({ message: 'Không tìm thấy địa chỉ.' });
        }
        res.status(200).json(updatedAddress);
    } catch (error) {
        next(error);
    }
};

export const deleteCustomerAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        const addressId = parseInt(req.params.addressId, 10);
        const success = await AddressModel.deleteAddress(addressId, customer.id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy địa chỉ.' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};