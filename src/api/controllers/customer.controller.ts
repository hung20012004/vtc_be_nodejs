// src/api/controllers/customer.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as CustomerModel from '../models/customer.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const getAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await CustomerModel.getAllCustomers();
    res.status(200).json(customers);
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const customer = await CustomerModel.findCustomerById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
    }
    res.status(200).json(customer);
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newCustomer = await CustomerModel.createCustomer(req.body);
    const user = req.user as User;
    await createActivityLog({
        user_id: user.id, action: 'create-customer',
        details: `User created customer '${newCustomer.name}' (ID: ${newCustomer.id})`,
        ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
    });
    res.status(201).json(newCustomer);
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedCustomer = await CustomerModel.updateCustomer(id, req.body);
    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng để cập nhật.' });
    }
    const user = req.user as User;
    await createActivityLog({
        user_id: user.id, action: 'update-customer',
        details: `User updated customer ID: ${id}`,
        ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
    });
    res.status(200).json(updatedCustomer);
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const success = await CustomerModel.deleteCustomer(id);
    if (!success) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng để xóa.' });
    }
    const user = req.user as User;
    await createActivityLog({
        user_id: user.id, action: 'delete-customer',
        details: `User deleted customer ID: ${id}`,
        ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};