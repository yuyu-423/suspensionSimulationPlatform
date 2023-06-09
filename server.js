import React, { useEffect, useState, useCallback } from 'react'
import { Typography, Divider, Col, Upload, message, Switch, Table, Modal, Row, Button, Slider, Card, Form, Select, Collapse, Tooltip } from 'antd';
import {
    InfoCircleOutlined, InboxOutlined
} from '@ant-design/icons';
import { nanoid } from 'nanoid';
//redux
import { useDispatch, useMappedState } from 'redux-react-hook'
import {
    setlocations_tmp,
    setflows_tmp,
    setconfig_tmp,
    setcustomlayers_tmp
} from '@/redux/actions/traj'
import { downloadFile } from '@/utils/downloadFile';
import axios from 'axios'
import { GeoJsonLayer } from '@deck.gl/layers';

const { Dragger } = Upload;
const { Title, Paragraph, Text, Link } = Typography;

const csv = require('csvtojson')
const { Panel } = Collapse;
const { Option } = Select;

export default function ODview() {

    const dispatch = useDispatch()
    const setlocations = (data) => {
        dispatch(setlocations_tmp(data))
    }
    const setflows = (data) => {
        dispatch(setflows_tmp(data))
    }
    const setconfig = (data) => {
        dispatch(setconfig_tmp(data))
    }
    const setcustomlayers = (data) => {
        dispatch(setcustomlayers_tmp(data))
    }


    /*
  ---------------redux中取出变量---------------
*/
    //#region
    const mapState = useCallback(
        state => ({
            traj: state.traj
        }),
        []
    );
    const { traj } = useMappedState(mapState);
    const { flows, locations, config, customlayers } = traj
    /*
      ---------------OD数据读取---------------
    */
    //#region
    const [layernum,setlayernum] = useState(1)
    const handleupload_traj = (file) => {
        console.log(file.name)
        message.loading({ content: '读取数据中', key: 'readcsv', duration: 0 })
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.readAsText(file)

            reader.onload = function (f) {

                const data = f.target.result

                if (file.name.slice(-3) == 'csv') {

                    let csvoption
                    if (data.slice(0, data.indexOf('\n')).split(',').map(f => isNaN(f[0])).indexOf(false) == -1) {
                        //有列名
                        csvoption = {}
                    } else {
                        //无列名
                        csvoption = {
                            noheader: true
                        }
                    }
                    csv(csvoption).fromString(data).then((jsonObj) => {

                        setisModalVisible(true)
                        const columns = []
                        Object.keys(jsonObj[0]).forEach(function (key) {
                            columns.push({ 'title': key, 'dataIndex': key, 'key': key })
                        })
                        setTableinfo({ ...tableinfo, columns, data: jsonObj })
                        const columnsnames = columns.map(f => f.key)
                        const SLON = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('slon') >= 0).indexOf(true)]
                        const SLAT = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('slat') >= 0).indexOf(true)]
                        const ELON = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('elon') >= 0).indexOf(true)]
                        const ELAT = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('elat') >= 0).indexOf(true)]
                        const COUNT = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('count') >= 0).indexOf(true)]
                        form.setFieldsValue({
                            SLON: typeof SLON === 'undefined' ? columnsnames[0] : SLON,
                            SLAT: typeof SLAT === 'undefined' ? columnsnames[1] : SLAT,
                            ELON: typeof ELON === 'undefined' ? columnsnames[2] : ELON,
                            ELAT: typeof ELAT === 'undefined' ? columnsnames[3] : ELAT,
                            COUNT: typeof COUNT === 'undefined' ? columnsnames[4] : COUNT,
                        })
                    })

                }
                if (file.name.slice(-4) == 'json') {
                    const jsondata = JSON.parse(data)
                    setcustomlayers(
                        [
                            ...customlayers,
                            new GeoJsonLayer({
                                id: 'Layer'+layernum.toString(),
                                type:jsondata.features[0].geometry.type,
                                data: jsondata,
                                pickable: true,
                                stroked: true,
                                filled: true,
                                extruded: true,
                                lineWidthScale: 20,
                                lineWidthMinPixels: 2,
                                opacity: 0.8,
                                getFillColor: [180, 180, 220],
                                getLineColor: [180, 180, 220],
                                getPointRadius: 100,
                                getLineWidth: 1,
                                getElevation: 30
                            })
                        ]
                    )
                    setlayernum(layernum+1)
                }
                message.destroy('readcsv')
            }
        })
    }
    const [tableinfo, setTableinfo] = useState({
        columns: [],
        data: [],
        count: 0,
        current: 1
    })
    //表单连接
    const [form] = Form.useForm()
    const [isModalVisible, setisModalVisible] = useState(false)

    const settraj = () => {
        setisModalVisible(false)
        const field = form.getFieldValue()
        processod(field, tableinfo.data)
    }
    //整理OD
    const processod = (field, data) => {
        //提取字段
        const { SLON, SLAT, ELON, ELAT, COUNT } = field
        const locations_tmp = {}
        const flows = data.map(f => {
            const sname = f[SLON] + ',' + f[SLAT]
            const ename = f[ELON] + ',' + f[ELAT]
            if (typeof locations_tmp[sname] == 'undefined') {
                if (COUNT == '=1') {
                    locations_tmp[sname] = 1
                } else {
                    locations_tmp[sname] = parseFloat(f[COUNT])
                }
            } else {
                if (COUNT == '=1') {
                    locations_tmp[sname] += 1
                } else {
                    locations_tmp[sname] += parseFloat(f[COUNT])
                }
            }
            if (typeof locations_tmp[ename] == 'undefined') {
                if (COUNT == '=1') {
                    locations_tmp[ename] = 1
                } else {
                    locations_tmp[ename] = parseFloat(f[COUNT])
                }
            } else {
                if (COUNT == '=1') {
                    locations_tmp[ename] += 1
                } else {
                    locations_tmp[ename] += parseFloat(f[COUNT])
                }
            }
            if (COUNT == '=1') {
                return {
                    origin: sname,
                    dest: ename,
                    count: 1
                }
            } else {
                return {
                    origin: sname,
                    dest: ename,
                    count: parseFloat(f[COUNT])
                }
            }
        })
        const locations = []
        for (let key in locations_tmp) {
            locations.push({ id: key, count: locations_tmp[key], lon: parseFloat(key.split(',')[0]), lat: parseFloat(key.split(',')[1]) })
        }
        setmaxflow(flows.reduce((x, y) => { return x.count > y.count ? x : y }).count)
        setconfig({ ...config, maxTopFlowsDisplayNum: flows.reduce((x, y) => { return x.count > y.count ? x : y }).count })
        setflows(flows)
        setlocations(locations)
    }

    useEffect(() => {
        axios.get('data/flows.json').then(response => {
            const flows = response.data
            axios.get('data/locations.json').then(response => {
                const locations = response.data

                setlocations(locations)
                setflows(flows)
                setmaxflow(flows.reduce((x, y) => { return x.count > y.count ? x : y }).count)
                setconfig({ ...config, maxTopFlowsDisplayNum: flows.reduce((x, y) => { return x.count > y.count ? x : y }).count })
            })
        })
    }, [])
    /*
      ---------------设置改变---------------
    */
    //#region
    const [form2] = Form.useForm()
    const handleconfigchange = (d) => {
        setconfig({ ...config, ...d })
    }
    const [maxflow, setmaxflow] = useState(100)


    return (
        <>
            <Col span={24}>
                <Card title="OD流向图" extra={<Tooltip title='Import OD data to show flow map'><InfoCircleOutlined /></Tooltip>}
                    bordered={false}>
                    <Collapse defaultActiveKey={['ImportOD', "Settings", 'Layers']}>
                        <Panel header="导入OD数据" key="ImportOD">
                            <Row gutters={4}>
                                <Col>
                                    <Dragger maxCount={1} beforeUpload={handleupload_traj}>
                                        <p className="ant-upload-drag-icon">
                                            <InboxOutlined />
                                        </p>
                                        <p className="ant-upload-text">点击或将数据拖到此处</p>
                                        <p className="ant-upload-hint">
                                        导入OD数据或geojson图层。OD数据至少需要四列，包括起点经纬度（slon、slat）与终点经纬度（elon、elat）。可以有计数列（count），如果没有计数列，则在count下拉选=1
                                        </p>
                                    </Dragger>
                                </Col>
                                {/* <Button type='primary' onClick={()=>{downloadFile(flows, "flows");downloadFile(locations, "locations")}}>downloadFile</Button> */}
                            </Row>
                        </Panel>
                        {customlayers.length>0?
                        <Panel header="图层" key="Layers">
                            <Table size='small' columns={[
                                {
                                    title: 'ID',
                                    dataIndex: 'id',
                                    key: 'id',
                                    render: text => text
                                },{
                                    title: '类型',
                                    dataIndex: 'type',
                                    key: 'type',
                                    render: text => text
                                }]} dataSource={customlayers.map((layer, index) => {
                                    return {
                                        id: layer.id,
                                        type:layer.props.type
                                    }
                                })} />
                        </Panel>:null}
                        <Panel header="OD设置" key="Settings">
                            <Form {...{
                                labelCol: { span: 16 },
                                wrapperCol: { span: 8 },
                            }}
                                size="small"
                                name="basic"
                                layout='inline'
                                form={form2}
                                initialValues={config}
                                autoComplete="off"
                                onValuesChange={handleconfigchange}
                            >
                                <Title level={4}>基础设置</Title>
                                <Row gutters={4}>
                                    <Col span={24}>
                                        <Form.Item label="颜色" name="colorScheme">
                                            <Select defaultValue='Teal'>
                                                {['Blues', 'BluGrn', 'BluYl', 'BrwnYl', 'BuGn', 'BuPu', 'Burg', 'BurgYl', 'Cool', 'DarkMint', 'Emrld', 'GnBu', 'Grayish', 'Greens', 'Greys', 'Inferno', 'Magenta', 'Magma', 'Mint', 'Oranges', 'OrRd', 'OrYel', 'Peach', 'Plasma', 'PinkYl', 'PuBu', 'PuBuGn', 'PuRd', 'Purp', 'Purples', 'PurpOr', 'RdPu', 'RedOr', 'Reds', 'Sunset', 'SunsetDark', 'Teal', 'TealGrn', 'Viridis', 'Warm', 'YlGn', 'YlGnBu', 'YlOrBr', 'YlOrRd'].map(v => { return <Option value={v}>{v}</Option> })}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="透明度" name="opacity">
                                            <Slider
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={typeof config.opacity === 'number' ? config.opacity : 0}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="动画特效" name="animationEnabled">
                                            <Switch size="small" checked={config.animationEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="显示节点" name="locationTotalsEnabled">
                                            <Switch size="small" checked={config.locationTotalsEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="黑色模式（地图样式为light时使用）" name="darkMode">
                                            <Switch size="small" checked={config.darkMode} />
                                        </Form.Item>
                                    </Col>

                                </Row>

                                <Divider />
                                <Title level={4}>聚类</Title>
                                <Row gutters={4}>
                                    <Col span={24}>
                                        <Form.Item label="是否聚类" name="clusteringEnabled">
                                            <Switch size="small" checked={config.clusteringEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="自动聚类参数" name="clusteringAuto">
                                            <Switch size="small" checked={config.clusteringAuto} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="聚类层数" name="clusteringLevel">
                                            <Slider
                                                min={0}
                                                max={20}
                                                step={1}
                                                value={typeof config.clusteringLevel === 'number' ? config.clusteringLevel : 0}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Divider />
                                    <Title level={4}>褪色</Title>

                                    <Col span={24}>
                                        <Form.Item label="是否褪色" name="fadeEnabled">
                                            <Switch size="small" checked={config.fadeEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="褪色透明" name="fadeOpacityEnabled">
                                            <Switch size="small" checked={config.fadeOpacityEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item label="褪色比例" name="fadeAmount">
                                            <Slider
                                                min={0}
                                                max={100}
                                                step={0.1}
                                                value={typeof config.fadeAmount === 'number' ? config.fadeAmount : 0}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form>
                        </Panel>

                    </Collapse>
                </Card>
            </Col>


            <Modal key="model" title="轨迹数据预览"
                width='80vw'
                height='80vh'
                visible={isModalVisible} onOk={settraj} onCancel={() => {
                    setisModalVisible(false)
                }}>


                <Form
                    {...{
                        labelCol: { span: 8 },
                        wrapperCol: { span: 0 },
                    }}
                    name="basic"
                    form={form}
                    initialValues={{ remember: true }}
                    autoComplete="off"
                >
                    <Row>
                        <Col span={4}>
                            <Form.Item name="SLON" label="slon">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="SLAT" label="slat">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="ELON" label="elon">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="ELAT" label="elat">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="COUNT" label="count">
                                <Select style={{ width: 120 }}>
                                    {[...tableinfo.columns, { key: '=1' }].map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
                <Table columns={tableinfo.columns}
                    dataSource={tableinfo.data}
                    rowKey={columns => nanoid()}
                    scroll={{ x: '100%' }}
                    size='small'
                    style={{
                        'overflowX': 'auto',
                        'overflowY': 'auto'
                    }} />
            </Modal>
        </>
    )

}


import React, { useState } from 'react';
import { Input, Row, Col, Button, Divider, Modal } from 'antd'
import { MinusCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
const { confirm } = Modal;
function Index() {

    const [data, setData] = useState([
        {
            'name': [''],
            'path': ['']
        }
    ])

    return (
        <div style={{ marginLeft: 50, marginTop: 100 }}>
            <div>
                {
                    data.map((item, index) => {
                        return <div>
                            <div style={{display:'flex'}}>
                                <span>第{index + 1}组</span>
                                <MinusCircleOutlined style={{ marginTop: 5, marginLeft: 8, display: data.length == 1 ? 'none' : '' }} onClick={() => {
                                    let flag = 0
                                    console.log(data[index]['name']);
                                    data[index]['name'].map(item=>{
                                        if(item != ''){
                                            flag = 1
                                            return false
                                        }
                                    })
                                    if(flag == 0){
                                        data[index]['path'].map(item=>{
                                            if(item != ''){
                                                flag = 1
                                                return false
                                            }
                                        })
                                    }

                                    if(flag){
                                        confirm({
                                            title: '已经编辑了部分数据，确认要删除',
                                            icon: <ExclamationCircleOutlined />,
                                            centered:'true',
                                            okText:'确认',
                                            cancelText:'取消',
                                            onOk() {
                                                let obj = [...data]
                                                setData([])
                                                obj.splice(index, 1);
                                                setData(obj)
                                            },
                                            onCancel() {},
                                        });
                                    }else{
                                        let obj = [...data]
                                        setData([])
                                        obj.splice(index, 1);
                                        setData(obj)
                                    }
                                   
                                }} />
                            </div>
                            <Divider />
                            <Row>
                                {
                                    item.name.map((nameItem, nameIndex) => {
                                        return <Col span={8}>
                                            <div style={{ display: 'flex', marginTop: 10 }}>
                                                <span >{'姓名' + (nameIndex + 1) + ':'}</span>
                                                <Input style={{ width: 200, marginLeft: 10 }} value={nameItem} onChange={(e) => {
                                                    let obj = [...data]
                                                    setData([])
                                                    obj[index]['name'][nameIndex] = e.target.value
                                                    setData(obj)
                                                }} />
                                                <MinusCircleOutlined style={{ marginTop: 10, marginLeft: 5, display: item.name.length == 1 ? 'none' : '' }} onClick={() => {
                                                    let obj = [...data]
                                                    setData([])
                                                    obj[index]['name'].splice(nameIndex, 1);
                                                    setData(obj)
                                                }} />
                                            </div>
                                        </Col>
                                    })
                                }
                            </Row>
                            <div style={{ display: 'flex', width: '100vw', justifyContent: 'center', marginTop: 10, marginBottom: 10 }}>
                                <Button type="dashed" width={200} onClick={() => {
                                    let obj = [...data]
                                    setData([])
                                    obj[index]['name'].push('')
                                    setData(obj);
                                }}>+添加人名</Button>
                            </div>
                            <Row>
                                {
                                    item.path.map((pathItem, pathIndex) => {
                                        return <Col span={8}>
                                            <div style={{ display: 'flex', marginTop: 10 }}>
                                                <span >{'路径' + (pathIndex + 1) + ':'}</span>
                                                <Input style={{ width: 200, marginLeft: 10 }} value={pathItem} onChange={(e) => {
                                                    let obj = [...data]
                                                    setData([])
                                                    obj[index]['path'][pathIndex] = e.target.value
                                                    setData(obj)
                                                }} />
                                                <MinusCircleOutlined style={{ marginTop: 10, marginLeft: 5, display: item.path.length == 1 ? 'none' : '' }} onClick={() => {
                                                    let obj = [...data]
                                                    setData([])
                                                    obj[index]['path'].splice(pathIndex, 1);
                                                    setData(obj)
                                                }} />
                                            </div>
                                        </Col>
                                    })
                                }
                            </Row>
                            <div style={{ display: 'flex', width: '100vw', justifyContent: 'center', marginTop: 10, marginBottom: 10 }}>
                                <Button type="dashed" width={200} onClick={() => {
                                    let obj = [...data]
                                    setData([])
                                    obj[index]['path'].push('')
                                    setData(obj);
                                }}>+添加路径</Button>
                            </div>

                        </div>
                    })
                }
            </div>
            <div style={{display:'flex', width:'100vw', justifyContent:'center', marginTop:10, marginBottom:10}}>
                <Button type="dashed" style={{width:'400px',}} onClick={()=>{
                    let obj = [...data]
                    setData([])
                    obj.push({
                        'name':[''],
                        'path':['']
                    })
                    setData(obj);
                }}>+分组</Button>
            </div>
        </div>
    )

}


export default Index